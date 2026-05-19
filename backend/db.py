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

def insert_grade(student_id, paper_id, evaluation_data):
    """
    Inserts a graded paper into the submissions collection.

    Expected schema shape:
        {
            "student_id"          : str,
            "paper_id"            : str,
            "overall_paper_score" : float,
            "maximum_paper_marks" : float,
            "question_results"    : list
        }
    The `timestamp` (UTC) and `student_id`/`paper_id` fields are added
    automatically by this function.
    """
    document = {
        "student_id": student_id,
        "paper_id":   paper_id,
        "evaluation": evaluation_data,
        "timestamp":  datetime.datetime.now(datetime.UTC),
    }
    result = submissions_collection.insert_one(document)
    print(f"Successfully saved grade for {student_id}. ID: {result.inserted_id}")
    return str(result.inserted_id)

def fetch_grades(paper_id):
    """Fetches all graded papers for a specific exam paper."""
    results = submissions_collection.find({"paper_id": paper_id})
    # Stringify ObjectId so the list is JSON-serializable by FastAPI
    grades = []
    for doc in results:
        doc["_id"] = str(doc["_id"])
        grades.append(doc)
    return grades


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
    # Insert a dummy record
    dummy_data = {"overall_score": 4.5, "status": "approved"}
    insert_grade("STU_999", "TEST_EXAM_01", dummy_data)
    
    # Fetch it back
    print("Fetching records...")
    records = fetch_grades("TEST_EXAM_01")
    print(records)