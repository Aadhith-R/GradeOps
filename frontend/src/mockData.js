/**
 * mockData.js — GradeOps Frontend Mock Data Generator
 *
 * Generates a randomised stress-test dataset of 15 students × 5 questions
 * each, mirroring the schema returned by the /grade-pdf backend endpoint.
 *
 * Import in App.jsx:
 *   import { generateStressTestData } from './mockData'
 */

export const generateStressTestData = () => {
  const students = []
  for (let i = 1; i <= 15; i++) {
    const studentId = `STU_${i.toString().padStart(3, '0')}`
    let overallScore = 0
    const questions = []

    for (let q = 1; q <= 5; q++) {
      const score        = Math.floor(Math.random() * 6)  // 0 to 5
      const isPlagiarized = Math.random() > 0.85           // ~15% chance
      overallScore += score

      questions.push({
        question_id:         `Q_${q}`,
        question_text:       `Please explain the core concepts of topic ${q} and provide 2 supporting pieces of evidence from the material.`,
        score_awarded:       score,
        max_question_score:  5.0,
        grading_breakdown: [
          {
            criteria:       `Addresses core concept for Question ${q}`,
            points_awarded: Math.min(score, 3.0),
            max_points:     3.0,
            notes:          score >= 3 ? 'Excellent core understanding.' : 'Missed foundational details.',
          },
          {
            criteria:       'Provides supporting evidence',
            points_awarded: Math.max(0, score - 3.0),
            max_points:     2.0,
            notes:          score === 5 ? 'Great examples and depth.' : 'Lacks sufficient elaboration.',
          },
        ],
        format_check_passed: score > 2,
        justification:
          score === 5
            ? 'Flawless execution of the prompt.'
            : 'Needs review on secondary concepts. Refer to grading breakdown.',
        plagiarism_flag: isPlagiarized,
        plagiarism_details: {
          matched_with:     isPlagiarized ? [`STU_${Math.floor(Math.random() * 15) + 1}`] : [],
          similarity_score: isPlagiarized
            ? parseFloat((0.85 + Math.random() * 0.1).toFixed(2))
            : 0.0,
        },
      })
    }

    students.push({
      student_id:          studentId,
      paper_id:            'EXAM_STRESS_TEST_01',
      overall_paper_score: overallScore,
      maximum_paper_marks: 25.0,   // 5 questions × 5 max marks
      question_results:    questions,
    })
  }
  return students
}
