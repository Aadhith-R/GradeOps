import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi

MONGO_URI = os.environ.get("MONGO_URI")  # Set this env var before starting the server

# Always define these at module level so imports never crash
client = None
db = None
results_collection = None

if not MONGO_URI:
    print("⚠️  MONGO_URI env var not set — DB writes will be skipped.")
else:
    try:
        client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
        db = client["gradeops_db"]
        results_collection = db["graded_papers"]
        print("✅ Successfully connected to MongoDB!")
    except Exception as e:
        print(f"❌ MongoDB Connection Error: {e}")


def save_grading_result(result_dict: dict):
    """
    Inserts a graded PaperGradingResult dict into MongoDB.
    No-ops gracefully if the DB connection is unavailable.
    """
    if results_collection is None:
        print("⚠️  DB not connected — skipping save.")
        return None
    insert_response = results_collection.insert_one(result_dict)
    print(f"💾 Saved paper to DB with Mongo ID: {insert_response.inserted_id}")
    return str(insert_response.inserted_id)

def update_grade_override(student_id: str, question_id: str, new_score: float):
    """
    Updates the score for a specific question and recalculates overall_paper_score
    so the document stays consistent after a TA override.
    No-ops gracefully if the DB connection is unavailable.
    """
    if results_collection is None:
        print("⚠️  DB not connected — skipping override update.")
        return

    # Step 1: update the individual question score
    update_response = results_collection.update_one(
        {"student_id": student_id, "question_results.question_id": question_id},
        {"$set": {"question_results.$.score_awarded": new_score}}
    )

    if update_response.modified_count == 0:
        print("⚠️ DB Update: Could not find that student/question to override.")
        return

    # Step 2: recalculate overall_paper_score from the updated question array
    paper = results_collection.find_one({"student_id": student_id})
    if paper:
        new_total = sum(q["score_awarded"] for q in paper["question_results"])
        results_collection.update_one(
            {"student_id": student_id},
            {"$set": {"overall_paper_score": new_total}}
        )
        print(f"📝 DB Update: Override saved. New total for {student_id}: {new_total}")