import json
import random

# NOTE: The local codebase uses `"rubric"` instead of `"rubric_conditions"` inside the Input Schema.
# This script respects the local `backend/schemas.py` contract.

def generate_dummy_data():
    # 1. Input Schema: Configured exam paper with multiple questions and rubrics
    input_schema = {
        "paper_id": "EXAM_FINAL_01",
        "subject_domain": "STEM",
        "total_questions": 2,
        "maximum_paper_marks": 10.0,
        "questions": [
            {
                "question_id": "Q_101",
                "question_text": "Explain the role of the mitochondria in cellular respiration.",
                "max_score": 5.0,
                "evaluation_config": {
                    "answer_format": "keyword_based",
                    "sentence_formation_required": True,
                    "reference_source": "llm_derived"
                },
                "teacher_solution": {
                    "exact_answer": None,
                    "required_steps": []
                },
                "rubric": [  # Locally enforced schema override from 'rubric_conditions'
                    {"criteria": "Mentions ATP production", "points": 3.0},
                    {"criteria": "Mentions energy powerhouse", "points": 2.0}
                ]
            },
            {
                "question_id": "Q_102",
                "question_text": "Describe the process of photosynthesis.",
                "max_score": 5.0,
                "evaluation_config": {
                    "answer_format": "long_form",
                    "sentence_formation_required": True,
                    "reference_source": "textbook"
                },
                "teacher_solution": {
                    "exact_answer": None,
                    "required_steps": ["Light dependent reactions", "Calvin cycle"]
                },
                "rubric": [
                    {"criteria": "Mentions sunlight conversion", "points": 2.5},
                    {"criteria": "Mentions glucose production", "points": 2.5}
                ]
            }
        ]
    }

    # 2. Output Schemas: 5-10 varied student grading results
    output_schemas = []
    
    # Student 1: Perfect Score
    output_schemas.append({
        "student_id": "STU_001_PERFECT",
        "paper_id": "EXAM_FINAL_01",
        "overall_paper_score": 10.0,
        "maximum_paper_marks": 10.0,
        "question_results": [
            {
                "question_id": "Q_101",
                "score_awarded": 5.0,
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions ATP production", "points_awarded": 3.0, "notes": "Clear mention of ATP synthesis."},
                    {"criteria": "Mentions energy powerhouse", "points_awarded": 2.0, "notes": "Identified as the powerhouse."}
                ],
                "format_check_passed": True,
                "justification": "Flawless explanation covering all essential metabolic pathways.",
                "plagiarism_flag": False,
                "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
            },
            {
                "question_id": "Q_102",
                "score_awarded": 5.0,
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions sunlight conversion", "points_awarded": 2.5, "notes": "Excellent detail on photons."},
                    {"criteria": "Mentions glucose production", "points_awarded": 2.5, "notes": "Correctly linked to Calvin cycle."}
                ],
                "format_check_passed": True,
                "justification": "Comprehensive understanding demonstrated.",
                "plagiarism_flag": False,
                "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
            }
        ]
    })

    # Student 2: Failed Score
    output_schemas.append({
        "student_id": "STU_002_FAIL",
        "paper_id": "EXAM_FINAL_01",
        "overall_paper_score": 0.0,
        "maximum_paper_marks": 10.0,
        "question_results": [
            {
                "question_id": "Q_101",
                "score_awarded": 0.0,
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions ATP production", "points_awarded": 0.0, "notes": "No mention of ATP."},
                    {"criteria": "Mentions energy powerhouse", "points_awarded": 0.0, "notes": "Completely missed the point."}
                ],
                "format_check_passed": False,
                "justification": "The student wrote about chloroplasts instead of mitochondria.",
                "plagiarism_flag": False,
                "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
            },
            {
                "question_id": "Q_102",
                "score_awarded": 0.0,
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions sunlight conversion", "points_awarded": 0.0, "notes": "Blank answer."},
                    {"criteria": "Mentions glucose production", "points_awarded": 0.0, "notes": "Blank answer."}
                ],
                "format_check_passed": False,
                "justification": "Left blank.",
                "plagiarism_flag": False,
                "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
            }
        ]
    })

    # Student 3: Plagiarism Flagged
    output_schemas.append({
        "student_id": "STU_003_FLAGGED",
        "paper_id": "EXAM_FINAL_01",
        "overall_paper_score": 0.0,
        "maximum_paper_marks": 10.0,
        "question_results": [
            {
                "question_id": "Q_101",
                "score_awarded": 0.0, # Nullified due to cheating
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions ATP production", "points_awarded": 3.0, "notes": "Technically correct but copied."},
                    {"criteria": "Mentions energy powerhouse", "points_awarded": 2.0, "notes": "Technically correct but copied."}
                ],
                "format_check_passed": True,
                "justification": "Answer is a 1:1 match with Wikipedia. Score nullified.",
                "plagiarism_flag": True,
                "plagiarism_details": {"matched_with": ["https://en.wikipedia.org/wiki/Mitochondrion"], "similarity_score": 0.98}
            },
            {
                "question_id": "Q_102",
                "score_awarded": 2.5,
                "max_question_score": 5.0,
                "grading_breakdown": [
                    {"criteria": "Mentions sunlight conversion", "points_awarded": 2.5, "notes": "Acceptable."},
                    {"criteria": "Mentions glucose production", "points_awarded": 0.0, "notes": "Missed entirely."}
                ],
                "format_check_passed": True,
                "justification": "Partial explanation provided, but heavily referenced external sites.",
                "plagiarism_flag": True,
                "plagiarism_details": {"matched_with": ["biology-forums.com"], "similarity_score": 0.85}
            }
        ]
    })

    # Students 4 to 8: Varied / Average Scores
    for i in range(4, 9):
        score1 = random.choice([2.0, 3.0, 5.0])
        score2 = random.choice([2.5, 5.0])
        
        output_schemas.append({
            "student_id": f"STU_00{i}_AVERAGE",
            "paper_id": "EXAM_FINAL_01",
            "overall_paper_score": score1 + score2,
            "maximum_paper_marks": 10.0,
            "question_results": [
                {
                    "question_id": "Q_101",
                    "score_awarded": score1,
                    "max_question_score": 5.0,
                    "grading_breakdown": [
                        {"criteria": "Mentions ATP production", "points_awarded": 3.0 if score1 >= 3.0 else 0.0, "notes": "Auto-graded note."},
                        {"criteria": "Mentions energy powerhouse", "points_awarded": 2.0 if score1 == 5.0 else score1 if score1 < 3.0 else 0.0, "notes": "Auto-graded note."}
                    ],
                    "format_check_passed": True,
                    "justification": "Good attempt with some missing details." if score1 < 5.0 else "Excellent answer.",
                    "plagiarism_flag": False,
                    "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
                },
                {
                    "question_id": "Q_102",
                    "score_awarded": score2,
                    "max_question_score": 5.0,
                    "grading_breakdown": [
                        {"criteria": "Mentions sunlight conversion", "points_awarded": 2.5, "notes": "Auto-graded note."},
                        {"criteria": "Mentions glucose production", "points_awarded": 2.5 if score2 == 5.0 else 0.0, "notes": "Auto-graded note."}
                    ],
                    "format_check_passed": True,
                    "justification": "Partial understanding of the Calvin cycle." if score2 < 5.0 else "Perfectly detailed.",
                    "plagiarism_flag": False,
                    "plagiarism_details": {"matched_with": [], "similarity_score": 0.0}
                }
            ]
        })

    return input_schema, output_schemas


if __name__ == "__main__":
    from db import insert_rubric, insert_grade

    exam_schema, student_results = generate_dummy_data()

    # 1. Seed the rubric into the rubrics collection
    rubric_id = insert_rubric(exam_schema.copy())
    print(f"[Seed] Rubric inserted -> {rubric_id}")

    # 2. Seed each student result into the submissions collection
    for result in student_results:
        grade_id = insert_grade(result.copy())
        print(f"[Seed] Grade inserted for {result['student_id']} -> {grade_id}")

    print(f"\n[Done] Seeded 1 rubric + {len(student_results)} student submissions into MongoDB.")

