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

# ... (keep your insert_grade and fetch_grades functions exactly the same below here) ...

def insert_grade(student_id, paper_id, evaluation_data):
    """Inserts a graded paper into the database."""
    document = {
        "student_id": student_id,
        "paper_id": paper_id,
        "evaluation": evaluation_data,
        "timestamp": datetime.datetime.now(datetime.UTC)
    }
    result = submissions_collection.insert_one(document)
    print(f"Successfully saved grade for {student_id}. ID: {result.inserted_id}")
    return str(result.inserted_id)

def fetch_grades(paper_id):
    """Fetches all graded papers for a specific exam."""
    results = submissions_collection.find({"paper_id": paper_id})
    # Convert cursor to a list and stringify the ObjectId so it's JSON serializable
    grades = []
    for doc in results:
        doc["_id"] = str(doc["_id"])
        grades.append(doc)
    return grades

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