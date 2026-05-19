import os
import json
import shutil
import fitz  # PyMuPDF — converts PDF pages to images
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from grading_agent import grade_paper
from database import save_grading_result, update_grade_override
from schemas import (
    EvaluationConfig, TeacherSolution, RubricCondition,
    QuestionItem, ExamPaperSchema,
    GradingBreakdown, PlagiarismDetails, QuestionResult,
    PaperGradingResult, GradeOverride,
)

# Directory where uploaded answer images are saved
UPLOAD_DIR = "uploads"
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


@app.post("/upload-rubric")
async def receive_rubric(paper: ExamPaperSchema):
    print(f"Received Exam: {paper.paper_id} with {paper.total_questions} questions.")
    print(f"Domain: {paper.subject_domain}")
    paper_dict = paper.model_dump()
    return {"status": "success", "data": paper_dict}

# --- ADD THIS TO YOUR ENDPOINTS (Bottom of file) ---
@app.put("/override-grade")
async def override_ai_grade(override: GradeOverride):
    """
    HITL Endpoint: Allows the TA to override the AI's proposed score.
    """
    # In Track A, this is where you will eventually write to MongoDB.
    # For now, we simulate the database update:
    print(f"⚠️ HITL TRIGGERED: TA Override for Student {override.student_id}")
    print(f"Question: {override.question_id}")
    print(f"New Score: {override.new_score}")
    print(f"Reason: {override.ta_justification}")

    # Update the score in MongoDB
    update_grade_override(override.student_id, override.question_id, override.new_score)
    
    return {
        "status": "success", 
        "message": f"Grade for {override.question_id} updated to {override.new_score} successfully."
    }


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
        result = grade_paper(
            image_sources=saved_paths,
            paper=paper,
            student_id=student_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Grading agent error: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Image file error: {e}")

    # Save the fully graded paper to MongoDB
    save_grading_result(result.model_dump())

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
        result = grade_paper(
            image_sources=page_images,
            paper=paper,
            student_id=student_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Grading agent error: {e}")

    # Save the fully graded paper to MongoDB
    save_grading_result(result.model_dump())

    return result