"""
schemas.py — Single source of truth for all Pydantic models.

Both main.py and grading_agent.py import from here,
which breaks the circular import that was caused by each importing the other.
"""

from pydantic import BaseModel
from typing import List, Optional, Any


# ------------------------------------------------------------------
# INPUT SCHEMAS (Rubric / Exam Paper)
# ------------------------------------------------------------------

class EvaluationConfig(BaseModel):
    answer_format: str
    sentence_formation_required: bool
    reference_source: str


class TeacherSolution(BaseModel):
    exact_answer: Optional[Any] = None
    required_steps: List[str] = []


class RubricCondition(BaseModel):
    criteria: str
    points: float


class QuestionItem(BaseModel):
    question_id: str
    question_text: str
    max_score: float
    evaluation_config: EvaluationConfig
    teacher_solution: TeacherSolution
    rubric: List[RubricCondition]       # renamed from rubric_conditions → rubric
                                        # to match RubricBuilder.jsx serialized output


class ExamPaperSchema(BaseModel):
    paper_id: str
    subject_domain: str
    total_questions: int
    maximum_paper_marks: float
    questions: List[QuestionItem]


# ------------------------------------------------------------------
# OUTPUT SCHEMAS (Grading Results)
# ------------------------------------------------------------------

class GradingBreakdown(BaseModel):
    criteria: str
    points_awarded: float
    notes: str


class PlagiarismDetails(BaseModel):
    matched_with: List[str]
    similarity_score: float


class QuestionResult(BaseModel):
    question_id: str
    score_awarded: float
    max_question_score: float
    grading_breakdown: List[GradingBreakdown]
    format_check_passed: bool
    justification: str
    plagiarism_flag: bool
    plagiarism_details: PlagiarismDetails


class PaperGradingResult(BaseModel):
    student_id: str
    paper_id: str
    overall_paper_score: float
    maximum_paper_marks: float
    question_results: List[QuestionResult]


# ------------------------------------------------------------------
# HITL SCHEMAS (TA Review / Override)
# ------------------------------------------------------------------

class GradeOverride(BaseModel):
    student_id: str
    question_id: str
    new_score: float
    ta_justification: Optional[str] = "Manual TA Override"
