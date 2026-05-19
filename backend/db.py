import os
# import certifi
import urllib.parse
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load the secret variables from the .env file
load_dotenv()

# 1. Grab the raw password securely from the .env file
raw_password = os.getenv("DB_PASSWORD")
if not raw_password:
    raise ValueError("CRITICAL: DB_PASSWORD is not set in the .env file. Database connection aborted.")

# 2. Python will safely encode any special characters
escaped_password = urllib.parse.quote_plus(raw_password)

# 3. Inject the escaped password into your exact cluster string using an f-string
# MAKE SURE to replace "cluster0.xxxxx" with your actual cluster address!
MONGO_URI = f"mongodb+srv://admin:{escaped_password}@nova85.msi1y0v.mongodb.net/?appName=Nova85"

# Initialize the connection
# client = MongoClient(MONGO_URI)
client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True)
db = client["gradeops_db"]
submissions_collection = db["submissions"]
rubrics_collection    = db["rubrics"]

# ─────────────────────────────────────────────────────────────────────────────
# Submission Functions
# ─────────────────────────────────────────────────────────────────────────────

def insert_grade(result_data: dict) -> str:
    """
    Inserts a graded paper into the submissions collection.
    The document is stored FLAT (no nesting), matching the Pydantic
    PaperGradingResult schema and the frontend dashboard's expectations.

    Expected schema shape:
        {
            "student_id"          : str,
            "paper_id"            : str,
            "overall_paper_score" : float,
            "maximum_paper_marks" : float,
            "question_results"    : list
        }
    A UTC `timestamp` is automatically stamped before insertion.
    """
    result_data["timestamp"] = datetime.datetime.now(datetime.UTC)
    result = submissions_collection.insert_one(result_data)
    sid = result_data.get("student_id", "unknown")
    print(f"Successfully saved grade for {sid}. ID: {result.inserted_id}")
    return str(result.inserted_id)


def fetch_grades(paper_id: str) -> list:
    """Fetches all graded papers for a specific exam paper."""
    results = submissions_collection.find({"paper_id": paper_id})
    # Stringify ObjectId so the list is JSON-serializable by FastAPI
    grades = []
    for doc in results:
        doc["_id"] = str(doc["_id"])
        grades.append(doc)
    return grades


def update_grade_override(student_id: str, question_id: str, new_score: float) -> None:
    """
    HITL override: Updates the score for a specific question inside a
    student's submission, then recalculates `overall_paper_score` to keep
    the document mathematically consistent.
    """
    # Step 1: update the individual question score using MongoDB's $ positional operator
    update_response = submissions_collection.update_one(
        {"student_id": student_id, "question_results.question_id": question_id},
        {"$set": {"question_results.$.score_awarded": new_score}},
    )

    if update_response.modified_count == 0:
        print(f"\u26a0\ufe0f  DB Update: Could not find {student_id}/{question_id} to override.")
        return

    # Step 2: recalculate overall_paper_score from the updated question array
    paper = submissions_collection.find_one({"student_id": student_id})
    if paper:
        new_total = sum(q["score_awarded"] for q in paper["question_results"])
        submissions_collection.update_one(
            {"student_id": student_id},
            {"$set": {"overall_paper_score": new_total}},
        )
        print(f"\U0001f4dd DB Update: Override saved. New total for {student_id}: {new_total}")


# ─────────────────────────────────────────────────────────────────────────────
# Rubric Functions
# ─────────────────────────────────────────────────────────────────────────────

def insert_rubric(rubric_data: dict) -> str:
    """
    Stamps the rubric with a UTC `created_at` timestamp, inserts it into
    `rubrics_collection`, and returns the stringified inserted ObjectId.

    Expected schema shape:
        {
            "paper_id"            : str,
            "subject_domain"      : str,
            "total_questions"     : int,
            "maximum_paper_marks" : float,
            "questions"           : list
        }
    """
    rubric_data["created_at"] = datetime.datetime.now(datetime.UTC)
    result = rubrics_collection.insert_one(rubric_data)
    print(f"Rubric saved for paper '{rubric_data.get('paper_id')}'. ID: {result.inserted_id}")
    return str(result.inserted_id)


def fetch_rubric(paper_id: str) -> dict | None:
    """
    Finds a single rubric document by `paper_id`.
    Returns the document with `_id` stringified, or None if not found.
    """
    doc = rubrics_collection.find_one({"paper_id": paper_id})
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def fetch_all_rubrics_metadata() -> list:
    """
    Returns a lightweight list of all rubrics, projecting only:
        paper_id, subject_domain, maximum_paper_marks, total_questions.
    All `_id` fields are stringified for JSON serialization.
    """
    projection = {
        "paper_id":            1,
        "subject_domain":      1,
        "maximum_paper_marks": 1,
        "total_questions":     1,
    }
    cursor = rubrics_collection.find({}, projection)
    rubrics = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        rubrics.append(doc)
    return rubrics

# --- TEST THE CONNECTION ---
if __name__ == "__main__":
    print("Testing MongoDB Connection...")
    # Insert a flat dummy record matching PaperGradingResult shape
    dummy_data = {
        "student_id":          "STU_999",
        "paper_id":            "TEST_EXAM_01",
        "overall_paper_score": 4.5,
        "maximum_paper_marks": 5.0,
        "question_results":    [],
    }
    insert_grade(dummy_data)

    # Fetch it back
    print("Fetching records...")
    records = fetch_grades("TEST_EXAM_01")
    print(records)