"""
main.py — GradeOps FastAPI Server (Unified)

All database operations route through the single DAL in db.py.
The deprecated database.py module is no longer imported.
"""

import os
import json
import time
import random
import shutil
import fitz  # PyMuPDF — converts PDF pages to images
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional


from db import (
    insert_grade,
    fetch_grades,
    update_grade_override,
    insert_rubric,
    fetch_rubric,
    fetch_all_rubrics_metadata,
)
from schemas import (
    EvaluationConfig, TeacherSolution, RubricCondition,
    QuestionItem, ExamPaperSchema,
    GradingBreakdown, PlagiarismDetails, QuestionResult,
    PaperGradingResult, GradeOverride,
)

# Directory where uploaded answer images are saved
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="GradeOps ML Engine API")

# Allow the React frontend to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace * with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches any unhandled exception and returns it as JSON so we can debug."""
    return JSONResponse(
        status_code=500,
        content={"error": type(exc).__name__, "detail": str(exc)},
    )


# ---------------------------------------------------------
# RUBRIC ENDPOINTS — persistent storage via db.py
# ---------------------------------------------------------

@app.post("/upload-rubric")
async def receive_rubric(paper: ExamPaperSchema):
    """
    Receives a rubric from the frontend, validates it via Pydantic,
    persistently stores it in MongoDB, and returns the saved document.
    """
    print(f"Received Exam: {paper.paper_id} with {paper.total_questions} questions.")
    print(f"Domain: {paper.subject_domain}")
    paper_dict = paper.model_dump()
    doc_id = insert_rubric(paper_dict)
    return {"status": "success", "inserted_id": doc_id, "data": paper_dict}


@app.get("/rubrics")
async def list_rubrics():
    """Returns lightweight metadata for all stored rubrics (for sidebar population)."""
    return fetch_all_rubrics_metadata()


@app.get("/rubrics/{paper_id}")
async def get_rubric(paper_id: str):
    """Returns the full rubric document for a given paper_id."""
    doc = fetch_rubric(paper_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No rubric found for paper_id: {paper_id}")
    return doc


# ---------------------------------------------------------
# HITL OVERRIDE ENDPOINT — unified through db.py
# ---------------------------------------------------------

@app.put("/override-grade")
async def override_ai_grade(override: GradeOverride):
    """
    HITL Endpoint: Allows the TA to override the AI's proposed score.
    Updates the specific question score and recalculates the paper total.
    """
    print(f"⚠️ HITL TRIGGERED: TA Override for Student {override.student_id}")
    print(f"Question: {override.question_id}")
    print(f"New Score: {override.new_score}")
    print(f"Reason: {override.ta_justification}")

    update_grade_override(override.student_id, override.question_id, override.new_score)

    return {
        "status": "success",
        "message": f"Grade for {override.question_id} updated to {override.new_score} successfully."
    }


# ---------------------------------------------------------
# GRADES QUERY ENDPOINT
# ---------------------------------------------------------

@app.get("/grades/{paper_id}")
async def get_grades(paper_id: str):
    """Returns all graded submissions for a given paper_id."""
    results = fetch_grades(paper_id)
    return results


# ---------------------------------------------------------
# GRADING ENDPOINT — multiple images (original)
# ---------------------------------------------------------
@app.post("/grade", response_model=PaperGradingResult)
async def grade_submission(
    student_id: str = Form(...),
    paper_json: str = Form(...),
    answer_images: List[UploadFile] = File(...)
):
    """
    Main grading endpoint (image-per-question mode).

    Accepts:
      - student_id      : plain form field
      - paper_json      : the ExamPaperSchema JSON (stringify it on the client side)
      - answer_images   : one image file per question (multipart)

    Returns a fully-graded PaperGradingResult JSON.
    """
    # 1. Parse the rubric JSON into the Pydantic model
    try:
        paper_data = json.loads(paper_json)
        paper = ExamPaperSchema(**paper_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid paper_json: {e}")

    # 2. Validate image count matches question count
    if len(answer_images) != len(paper.questions):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Got {len(answer_images)} image(s) but rubric has "
                f"{len(paper.questions)} question(s). Must match."
            ),
        )

    # 3. Save uploaded images to disk
    saved_paths: List[str] = []
    for i, upload in enumerate(answer_images):
        ext = os.path.splitext(upload.filename)[-1] or ".jpg"
        save_path = os.path.join(UPLOAD_DIR, f"{student_id}_{paper.paper_id}_q{i}{ext}")
        with open(save_path, "wb") as f:
            shutil.copyfileobj(upload.file, f)
        saved_paths.append(save_path)

    # 4. Run the Gemini grading pipeline
    try:
        from grading_agent import grade_paper
        result = grade_paper(
            image_sources=saved_paths,
            paper=paper,
            student_id=student_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Grading agent error: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Image file error: {e}")

    # 5. Save flat grading result to MongoDB via unified DAL
    insert_grade(result.model_dump())

    return result


# ---------------------------------------------------------
# GRADING ENDPOINT — single PDF upload (for frontend)
# ---------------------------------------------------------
@app.post("/grade-pdf", response_model=PaperGradingResult)
async def grade_pdf_submission(
    student_id: str = Form(...),
    paper_json: str = Form(...),
    exam_pdf: UploadFile = File(...)
):
    """
    PDF grading endpoint.

    Accepts:
      - student_id : plain form field
      - paper_json : the ExamPaperSchema JSON (stringify it on the client side)
      - exam_pdf   : a single PDF file — each page = one question's answer

    Each page of the PDF is converted to a PNG image in memory using PyMuPDF,
    then fed into the same Gemini grading pipeline.
    """
    # 1. Parse the rubric JSON
    try:
        paper_data = json.loads(paper_json)
        paper = ExamPaperSchema(**paper_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid paper_json: {e}")

    # 2. Read the PDF bytes into memory
    pdf_bytes = await exam_pdf.read()

    # 3. Open the PDF and extract each page as a PNG image (in memory)
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not open PDF: {e}")

    page_images: List[bytes] = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        # Render at 2x resolution for better handwriting recognition
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        page_images.append(pix.tobytes("png"))
        print(f"  📄 Extracted page {page_num + 1}/{len(doc)} ({pix.width}x{pix.height})")
    doc.close()

    # 4. Validate page count matches question count
    if len(page_images) != len(paper.questions):
        raise HTTPException(
            status_code=422,
            detail=(
                f"PDF has {len(page_images)} page(s) but rubric has "
                f"{len(paper.questions)} question(s). Must match (1 page = 1 question)."
            ),
        )

    # 5. Run the Gemini grading pipeline with in-memory images
    try:
        from grading_agent import grade_paper
        result = grade_paper(
            image_sources=page_images,
            paper=paper,
            student_id=student_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Grading agent error: {e}")

    # 6. Save flat grading result to MongoDB via unified DAL
    insert_grade(result.model_dump())

    return result


# ---------------------------------------------------------
# DUMMY DATA GENERATOR
# ---------------------------------------------------------
@app.post("/generate-dummy")
async def generate_dummy():
    """Generates a mock rubric + 15 graded submissions with a dynamic paper_id."""
    paper_id = f"EXAM_{int(time.time())}"
    n_stu, n_q, max_q = 15, 5, 5.0
    max_marks = n_q * max_q

    questions = []
    for q in range(1, n_q + 1):
        questions.append({
            "question_id": f"Q_{q}",
            "question_text": f"Question {q}: Explain the key concepts.",
            "max_score": max_q,
            "evaluation_config": {"answer_format": "keyword", "sentence_formation_required": False, "reference_source": ""},
            "rubric_conditions": [
                {"criteria": f"Addresses core concept for Q{q}", "points": 3.0},
                {"criteria": "Provides supporting evidence", "points": 2.0},
            ],
            "teacher_solution": {"exact_answer": None, "required_steps": []},
        })
    insert_rubric({"paper_id": paper_id, "subject_domain": "General", "total_questions": n_q, "maximum_paper_marks": max_marks, "questions": questions})

    for i in range(1, n_stu + 1):
        sid = f"STU_{str(i).zfill(3)}"
        total = 0
        qr = []
        for q in range(1, n_q + 1):
            sc = random.randint(0, int(max_q))
            plag = random.random() > 0.85
            qr.append({
                "question_id": f"Q_{q}", "score_awarded": float(sc), "max_question_score": max_q,
                "grading_breakdown": [
                    {"criteria": f"Core concept Q{q}", "points_awarded": min(sc, 3.0), "notes": "Good." if sc >= 3 else "Missed details."},
                    {"criteria": "Supporting evidence", "points_awarded": max(0, sc - 3.0), "notes": "Solid." if sc == 5 else "Needs elaboration."},
                ],
                "format_check_passed": sc > 2,
                "justification": "Flawless." if sc == 5 else "Needs review on secondary concepts.",
                "plagiarism_flag": plag,
                "plagiarism_details": {
                    "matched_with": [f"STU_{str(random.randint(1, n_stu)).zfill(3)}"] if plag else [],
                    "similarity_score": round(0.85 + random.random() * 0.1, 2) if plag else 0.0,
                },
            })
            total += sc
        insert_grade({"student_id": sid, "paper_id": paper_id, "overall_paper_score": float(total), "maximum_paper_marks": max_marks, "question_results": qr})

    return {"status": "success", "paper_id": paper_id, "students_generated": n_stu}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
