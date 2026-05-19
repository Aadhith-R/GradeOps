"""
seed.py — GradeOps Database Seeder
Ports the React stress-test generator to Python and inserts:
  • 1 exam rubric  (EXAM_STRESS_TEST_01)
  • 15 student submissions
Run once from the backend directory:  python seed.py
"""

import random
import sys
import os

# Make sure the sibling db.py is on the path when run from /backend
sys.path.insert(0, os.path.dirname(__file__))

from db import insert_rubric, insert_grade, submissions_collection, rubrics_collection

# ── Config ────────────────────────────────────────────────────────────────────
PAPER_ID        = "EXAM_STRESS_TEST_01"
NUM_STUDENTS    = 15
NUM_QUESTIONS   = 5
MAX_Q_SCORE     = 5.0
MAX_PAPER_MARKS = NUM_QUESTIONS * MAX_Q_SCORE   # 25.0


# ── 1. Seed Rubric ────────────────────────────────────────────────────────────

def build_rubric() -> dict:
    """Constructs the rubric document matching insert_rubric's expected schema."""
    questions = []
    for q in range(1, NUM_QUESTIONS + 1):
        questions.append({
            "question_id":       f"Q_{q}",
            "max_score":         MAX_Q_SCORE,
            "question_type":     "Short Answer (Keyword)",
            "evaluation_config": {
                "subject_domain":              "General",
                "answer_format":               "keyword",
                "sentence_formation_required": False,
            },
            "rubric": [
                {"criteria": f"Addresses core concept for Question {q}", "points": 3.0},
                {"criteria": "Provides supporting evidence",             "points": 2.0},
            ],
        })

    return {
        "paper_id":            PAPER_ID,
        "subject_domain":      "General",
        "total_questions":     NUM_QUESTIONS,
        "maximum_paper_marks": MAX_PAPER_MARKS,
        "questions":           questions,
    }


# ── 2. Seed Submissions ───────────────────────────────────────────────────────

def build_submission(student_num: int) -> tuple[str, str, dict]:
    """Returns (student_id, paper_id, evaluation_data) for one student."""
    student_id    = f"STU_{str(student_num).zfill(3)}"
    overall_score = 0
    question_results = []

    for q in range(1, NUM_QUESTIONS + 1):
        score        = random.randint(0, int(MAX_Q_SCORE))
        is_plagiarised = random.random() > 0.85  # ~15% chance

        grading_breakdown = [
            {
                "criteria":       f"Addresses core concept for Question {q}",
                "points_awarded": min(score, 3.0),
                "max_points":     3.0,
                "notes": (
                    "Excellent core understanding."
                    if score >= 3 else "Missed foundational details."
                ),
            },
            {
                "criteria":       "Provides supporting evidence",
                "points_awarded": max(0, score - 3.0),
                "max_points":     2.0,
                "notes": (
                    "Great examples and depth."
                    if score == 5 else "Lacks sufficient elaboration."
                ),
            },
        ]

        matched_with = (
            [f"STU_{str(random.randint(1, NUM_STUDENTS)).zfill(3)}"]
            if is_plagiarised else []
        )
        similarity   = round(0.85 + random.random() * 0.1, 2) if is_plagiarised else 0.0

        question_results.append({
            "question_id":        f"Q_{q}",
            "score_awarded":      float(score),
            "max_question_score": MAX_Q_SCORE,
            "grading_breakdown":  grading_breakdown,
            "format_check_passed": score > 2,
            "justification": (
                "Flawless execution of the prompt."
                if score == 5
                else "Needs review on secondary concepts. Refer to grading breakdown."
            ),
            "plagiarism_flag":    is_plagiarised,
            "plagiarism_details": {
                "matched_with":    matched_with,
                "similarity_score": similarity,
            },
        })

        overall_score += score

    evaluation_data = {
        "overall_paper_score": float(overall_score),
        "maximum_paper_marks": MAX_PAPER_MARKS,
        "question_results":    question_results,
    }

    return student_id, PAPER_ID, evaluation_data


# ── Entrypoint ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("GradeOps DB Seeder")
    print("=" * 60)

    # --- Rubric ---
    print(f"\n[1/2] Inserting rubric for '{PAPER_ID}'...")
    rubric = build_rubric()
    rid = insert_rubric(rubric)
    print(f"      ✓ Rubric inserted  →  _id: {rid}")

    # --- Submissions ---
    print(f"\n[2/2] Inserting {NUM_STUDENTS} student submissions...")
    for i in range(1, NUM_STUDENTS + 1):
        sid, pid, ev = build_submission(i)
        doc_id = insert_grade(sid, pid, ev)
        print(f"      ✓ {sid} inserted  →  _id: {doc_id}")

    print("\n" + "=" * 60)
    print(f"Seed complete. {1} rubric + {NUM_STUDENTS} submissions written to MongoDB.")
    print("=" * 60)


if __name__ == "__main__":
    main()
