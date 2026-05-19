# Reconnaissance & Architectural Mapping Report: GradeOps DB Merge

This report maps out the structural, functional, and security differences between your robust Data Access Layer (`backend/db.py`) and your teammate's backend reference database implementation (`backend-ref/database.py`, `backend-ref/schemas.py`, and endpoints in `backend-ref/main.py`).

---

## 1. Plain English Translation of Teammate's Implementation

Your teammate's database module (`database.py`) and schema system (`schemas.py`) are designed to support a FastAPI web app integrating a Gemini multimodal grading pipeline. Here is exactly what their code is attempting to do:

### Database & Connections (`database.py`)
- **Connection Configuration**: It reads a `MONGO_URI` connection string from system environment variables. If it's missing, it prints a warning and skips database writes entirely (no-ops gracefully) rather than crashing.
- **Collections Created**: It initializes a single collection named **`graded_papers`** inside the database named `gradeops_db`.
- **Primary CRUD Operations**:
  - **`save_grading_result(result_dict)`**: Saves a fully evaluated student paper to the DB and returns the stringified Mongo `inserted_id`.
  - **`update_grade_override(student_id, question_id, new_score)`**: An administrative helper for TA Human-in-the-Loop (HITL) manual overrides. It updates a specific question's score in the `question_results` array using MongoDB's position operator (`$`), retrieves the document, sums up the question-level scores, and recalculates the total `overall_paper_score` dynamically to maintain mathematical consistency.

### Schemas (`schemas.py`)
- Defines robust **Pydantic v2** validation models that categorize the application state into three clear pipelines:
  - **Input Schemas**: Validates rubric configuration (`ExamPaperSchema`, `QuestionItem`, `EvaluationConfig`, `TeacherSolution`, `RubricCondition`).
  - **Output Schemas**: Validates AI evaluations (`PaperGradingResult`, `QuestionResult`, `GradingBreakdown`, `PlagiarismDetails`).
  - **HITL Schemas**: Validates manual TA edits (`GradeOverride`).

---

## 2. The Overlap (Where the Implementations Collide)

Our two implementations share identical domains but operate under slightly different nomenclature and collection arrangements:

| Domain | Your DAL (`backend/db.py`) | Teammate's Reference (`database.py` / `schemas.py`) |
| :--- | :--- | :--- |
| **Database Name** | `gradeops_db` | `gradeops_db` |
| **Primary Collections** | `submissions` (graded papers) & `rubrics` (configured schemas) | `graded_papers` (graded papers only; rubrics are passed in-memory during submission) |
| **Save/Insert Grading** | `insert_grade()` (stores evaluation payload, student details, and paper ID) | `save_grading_result()` (stores a dump of the Pydantic `PaperGradingResult` schema) |
| **Fetch Grading** | `fetch_grades(paper_id)` (stringifies `_id`) | Not implemented in `database.py` (simulated directly in endpoints or not stored/queried in bulk) |
| **Rubric Storage** | Explicit storage in `rubrics` collection via `insert_rubric` / `fetch_rubric` | None. Rubrics are accepted on the fly at `/grade` or `/grade-pdf` and passed to the ML pipeline without permanent DB persistence. |

---

## 3. Structural & Schema Conflicts

Your DAL was meticulously engineered to align with the frontend contracts, but your teammate's models diverge in a few subtle, critical areas:

### A. Document Schema Mismatches
1. **Rubric Field Names**:
   - In your teammate's model (`QuestionItem` in `schemas.py`), the list of criteria is called **`rubric_conditions`** (containing a list of `RubricCondition` objects with key names `criteria` and `points`).
   - In the frontend builder (`RubricBuilder.jsx`), the serialized payload calls this field **`rubric`** (with key names `criteria` and `points`).
   - **Conflict**: If the frontend submits `rubric`, the teammate's FastAPI endpoint will fail validation because it expects `rubric_conditions`.

2. **Submission Document Layout**:
   - **Your DAL (`db.py`)**: Stores grades with `student_id`, `paper_id`, a nested `evaluation` object containing evaluation details, and an automatic `timestamp`.
   - **Teammate (`schemas.py`)**: Defines a completely flat grading result schema (`PaperGradingResult`) where `student_id` and `paper_id` are top-level alongside `question_results`, and `overall_paper_score`. There is no separate nested `evaluation` object.
   - **Impact**: Your frontend dashboard (`ReviewDashboard.jsx`) reads from a flat student object (e.g., `student.overall_paper_score` and `student.question_results`). Your teammate's `PaperGradingResult` is flat and matches this, but your DAL `insert_grade` function wraps the raw data inside an `"evaluation"` key. This means grades pulled from your DAL will have a different structure than grades produced by their endpoint.

3. **FASTAPI Serialization & `ObjectId` Handling**:
   - **Your DAL (`db.py`)**: Explicitly converts cursor outputs and stringifies all MongoDB `_id` fields prior to returning.
   - **Teammate (`database.py`)**: `save_grading_result` returns a stringified `inserted_id`, but they do not have a query function (`fetch_grades`) implemented. If they implement queries, they will need your stringification logic to prevent FastAPI serialization crashes.

---

## 4. The Security Check

There is a major architectural security variance between the two implementations:

- **Teammate's reference (`database.py` / `main.py`)**:
  - Uses `MONGO_URI = os.environ.get("MONGO_URI")` directly from system environment variables.
  - While it does not hardcode passwords in the code, it expects the connection string to contain the username and password in plain text inside the environment variable.
- **Your DAL (`db.py`)**:
  - Implements a much safer, production-grade credential parser.
  - It loads the raw database password securely from `.env` (`os.getenv("DB_PASSWORD")`), encodes it safely using `urllib.parse.quote_plus()`, and dynamically interpolates it into the cluster URI.
  - This prevents crashes and security issues caused by special characters (like `@` or `:`) inside raw password strings in connection URIs.

---

## 5. Summary Recommendation for the Merge

To successfully merge these two codebases without breaking your high-fidelity frontend UI or their ML grading pipeline, we should adopt these architectural decisions:

1. **Unify the Collections**:
   - Rename their `graded_papers` collection to your cleaner **`submissions`** collection.
   - Adopt your **`rubrics`** collection so that rubrics are persistently stored and accessible (e.g. for loading prior exam rubrics in the sidebar) rather than just transiently passed.
2. **Adopt Your Connection & Security Parser**:
   - Keep your dynamic `DB_PASSWORD` URL-escaping logic as the sole way `MONGO_URI` is generated.
3. **Bridge the Schema Gap**:
   - Keep Pydantic schemas in `schemas.py` for FastAPI validation, but ensure the fields align perfectly with the frontend (e.g., rename `rubric_conditions` to `rubric`).
   - Standardize on the flat schema shape of `PaperGradingResult` for the `submissions` collection, ensuring both manual TA edits and automated grading write to the same document structures.
