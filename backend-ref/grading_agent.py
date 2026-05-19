"""
grading_agent.py — GradeOps Grading Engine

Uses the google-genai SDK (the new, supported replacement for google-generativeai).

Public functions:
  - grade_question(image_source, question)         → QuestionResult
  - grade_paper(image_sources, paper, student_id)  → PaperGradingResult
"""

import os
import json
import mimetypes
from pathlib import Path
from typing import Union

from google import genai
from google.genai import types

from schemas import (
    QuestionItem,
    QuestionResult,
    ExamPaperSchema,
    PaperGradingResult,
)

# ---------------------------------------------------------------------------
# Gemini client — initialised once at import time
# ---------------------------------------------------------------------------
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not _GEMINI_API_KEY:
    raise EnvironmentError(
        "GEMINI_API_KEY environment variable is not set.\n"
        "Export it before starting the server:  export GEMINI_API_KEY='your-key-here'"
    )

_client = genai.Client(api_key=_GEMINI_API_KEY)
_MODEL = "gemini-2.5-flash"

# Set MOCK_MODE=true to skip Gemini calls and return fake grades.
# Useful for testing the pipeline when API quota is exhausted.
_MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() == "true"


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_grading_prompt(question: QuestionItem) -> str:
    """Constructs the instruction prompt with the rubric embedded."""

    rubric_lines = "\n".join(
        f"  {i+1}. Criteria: \"{rc.criteria}\" — worth {rc.points} point(s)"
        for i, rc in enumerate(question.rubric_conditions)
    )

    breakdown_template = json.dumps(
        [
            {
                "criteria": rc.criteria,
                "points_awarded": 0.0,
                "notes": "<your brief explanation>",
            }
            for rc in question.rubric_conditions
        ],
        indent=4,
    )

    format_note = (
        "Also check: does the student write in complete, coherent sentences? "
        "Set format_check_passed to true only if they do."
        if question.evaluation_config.sentence_formation_required
        else "Set format_check_passed to true (format is not strictly checked for this question)."
    )

    return f"""You are a strict but fair academic grader evaluating a student's HANDWRITTEN exam answer.

=== QUESTION ===
{question.question_text}

=== MAXIMUM SCORE ===
{question.max_score} point(s)

=== GRADING RUBRIC ===
Award points for each condition independently (partial credit is allowed):
{rubric_lines}

=== FORMAT REQUIREMENT ===
Expected answer format: {question.evaluation_config.answer_format}
{format_note}

=== YOUR TASK ===
1. Carefully read the handwritten text in the attached image.
2. For EACH rubric condition, decide how many points to award (0 to the max for that condition).
3. score_awarded MUST equal the sum of all points_awarded, and CANNOT exceed {question.max_score}.
4. Write a one-paragraph justification summarising the overall grade.

=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object. No markdown fences, no extra text:

{{
    "question_id": "{question.question_id}",
    "score_awarded": <sum of all points_awarded as a float>,
    "max_question_score": {question.max_score},
    "grading_breakdown": {breakdown_template},
    "format_check_passed": <true or false>,
    "justification": "<one paragraph>",
    "plagiarism_flag": false,
    "plagiarism_details": {{
        "matched_with": [],
        "similarity_score": 0.0
    }}
}}"""


# ---------------------------------------------------------------------------
# Image loader — supports file paths OR raw bytes
# ---------------------------------------------------------------------------

def _load_image_part(image_source: Union[str, bytes]) -> types.Part:
    """
    Returns a google-genai Part from either:
      - a file path (str)  → reads from disk
      - raw bytes (bytes)  → uses directly (e.g. from PDF page extraction)
    """
    if isinstance(image_source, bytes):
        return types.Part.from_bytes(data=image_source, mime_type="image/png")

    path = Path(image_source)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_source}")

    mime, _ = mimetypes.guess_type(str(path))
    if mime not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        mime = "image/jpeg"

    return types.Part.from_bytes(data=path.read_bytes(), mime_type=mime)


# ---------------------------------------------------------------------------
# Core grading function — single question
# ---------------------------------------------------------------------------

def grade_question(image_source: Union[str, bytes], question: QuestionItem) -> QuestionResult:
    """
    Grade one handwritten answer against a single question's rubric.
    image_source can be a file path (str) or raw PNG bytes.
    Set MOCK_MODE=true to skip the Gemini call and return a fake result.
    """
    # --- MOCK MODE (no Gemini call) ---
    if _MOCK_MODE:
        print(f"  [MOCK] Grading {question.question_id} without Gemini.")
        mock_breakdown = [
            {
                "criteria": rc.criteria,
                "points_awarded": rc.points,
                "notes": "[MOCK] Criteria met — this is a simulated grade.",
            }
            for rc in question.rubric_conditions
        ]
        mock_score = sum(rc.points for rc in question.rubric_conditions)
        return QuestionResult(
            question_id=question.question_id,
            score_awarded=min(mock_score, question.max_score),
            max_question_score=question.max_score,
            grading_breakdown=mock_breakdown,
            format_check_passed=True,
            justification="[MOCK] Student demonstrated understanding of the core concept.",
            plagiarism_flag=False,
            plagiarism_details={"matched_with": [], "similarity_score": 0.0},
        )

    # --- REAL MODE (Gemini call) ---
    prompt = _build_grading_prompt(question)
    image_part = _load_image_part(image_source)

    response = _client.models.generate_content(
        model=_MODEL,
        contents=[prompt, image_part],
        config=types.GenerateContentConfig(
            temperature=0.1,
        ),
    )

    raw_text = response.text.strip()

    # Gemini sometimes wraps JSON in markdown fences — strip them if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        result_dict = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned non-JSON for question {question.question_id}.\n"
            f"Raw response: {raw_text[:500]}\nError: {e}"
        )

    return QuestionResult(**result_dict)


# ---------------------------------------------------------------------------
# Full-paper grading function
# ---------------------------------------------------------------------------

def grade_paper(
    image_sources: list[Union[str, bytes]],
    paper: ExamPaperSchema,
    student_id: str,
) -> PaperGradingResult:
    """
    Grade a full exam paper: one image per question.

    Args:
        image_sources: List of image paths (str) or raw PNG bytes, same order as paper.questions.
        paper:         The ExamPaperSchema with rubrics for all questions.
        student_id:    The student's identifier string.

    Returns:
        A PaperGradingResult with all QuestionResults and the total score.
    """
    if len(image_sources) != len(paper.questions):
        raise ValueError(
            f"Mismatch: {len(image_sources)} images supplied for "
            f"{len(paper.questions)} questions."
        )

    question_results: list[QuestionResult] = []

    for image_source, question in zip(image_sources, paper.questions):
        print(f"  Grading {question.question_id} ...")
        result = grade_question(image_source, question)
        question_results.append(result)

    overall_score = sum(r.score_awarded for r in question_results)

    return PaperGradingResult(
        student_id=student_id,
        paper_id=paper.paper_id,
        overall_paper_score=overall_score,
        maximum_paper_marks=paper.maximum_paper_marks,
        question_results=question_results,
    )
