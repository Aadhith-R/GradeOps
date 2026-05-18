import { useState, useEffect, useRef } from 'react'

// (mock data has been lifted to App.jsx)

// ── Loading State ─────────────────────────────────────────────────────────────

function LoadingView({ processingLogs }) {
  const logEndRef = useRef(null)
  const [barWidth, setBarWidth] = useState(2)

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(92), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [processingLogs])

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
      <div className="w-full max-w-lg space-y-6">
        {/* Icon + Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/25">
            <svg
              className="w-7 h-7 text-blue-400 animate-spin"
              fill="none" viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Processing Submission</h2>
            <p className="text-sm text-slate-500 mt-1">AI evaluation pipeline is running…</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Pipeline progress</span>
            <span>{processingLogs.length} / 8 steps</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all ease-out"
              style={{ width: `${barWidth}%`, transitionDuration: '6000ms' }}
            />
          </div>
        </div>

        {/* Terminal Box */}
        <div className="bg-black border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/40">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-slate-600 font-mono">gradeops — evaluation pipeline</span>
          </div>
          <div className="p-4 font-mono text-xs h-52 overflow-y-auto
            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-slate-700
            [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            {processingLogs.length === 0 && (
              <span className="text-slate-700">Waiting for pipeline…</span>
            )}
            {processingLogs.map((log, i) => {
              const isStatus = log.startsWith('[Status]')
              const isVision = log.startsWith('[Vision]')
              const isAgent = log.startsWith('[Agent]')
              const color = isStatus ? 'text-green-400' : isVision ? 'text-cyan-400' : isAgent ? 'text-yellow-400' : 'text-slate-300'
              return (
                <div key={i} className={`leading-relaxed ${color}`}>
                  <span className="text-slate-700 select-none mr-2">
                    {String(i + 1).padStart(2, '0')} $
                  </span>
                  {log}
                </div>
              )
            })}
            <div className="inline-block w-2 h-3.5 bg-green-400 animate-pulse ml-1 align-middle" />
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({ dashboardData, setDashboardData, currentIndex, setCurrentIndex }) {
  const [openQ, setOpenQ] = useState({ 0: true })
  const [overrideScore, setOverrideScore] = useState('')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const overrideRef = useRef(null)

  const allDone = currentIndex >= dashboardData.length
  const student = allDone ? null : dashboardData[currentIndex]
  const hasPlagiarism = !allDone && student.question_results.some(q => q.plagiarism_flag)
  const scorePercent = allDone ? 0 : (student.overall_paper_score / student.maximum_paper_marks) * 100

  const handleApprove = () => {
    if (allDone) return
    console.log('✅ [GradeOps] Grade APPROVED —', `Student: ${student.student_id}`, `| Score: ${student.overall_paper_score} / ${student.maximum_paper_marks}`)
    setCurrentIndex(i => i + 1)
    setOpenQ({ 0: true })
    setOverrideScore('')
  }

  const handleSaveOverride = () => {
    if (overrideScore === '' || allDone) return
    const newScore = Number(overrideScore)
    console.log('✏️ [GradeOps] Manual override saved —', `Student: ${student.student_id}`, `| New score: ${newScore}`)
    setDashboardData(prev => prev.map((s, i) =>
      i === currentIndex ? { ...s, overall_paper_score: newScore } : s
    ))
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 2000)
  }

  // Keyboard shortcuts — deps include handleApprove/overrideRef to avoid stale closure
  useEffect(() => {
    const handler = e => {
      if (e.shiftKey && e.key === 'A') { e.preventDefault(); handleApprove() }
      if (e.shiftKey && e.key === 'O') { e.preventDefault(); overrideRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIndex, allDone])

  return (
    <div className="flex h-full">

      {/* ── Left Pane: Student Scan ── */}
      <div className="w-1/2 h-full flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Pane header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Student Scan</span>
          </div>
          <span className="text-xs text-slate-600">{student?.student_id ?? '—'}</span>
        </div>

        {/* Placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-950/40">
          <div className="flex flex-col items-center gap-3 text-center p-8 max-w-xs">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-400">Student Scan PDF / Image Placeholder</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              The student's scanned answer sheet will be rendered here for side-by-side review.
            </p>
            <div className="flex gap-2 mt-1">
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-500">Page 1 / 3</span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-500">PDF · 2.4 MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Pane: Grading Results ── */}
      <div className="w-1/2 h-full flex flex-col bg-slate-950">

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-slate-800
          [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {allDone ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-green-600/20 border border-green-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">All papers graded!</h3>
                <p className="text-sm text-slate-500 mt-1">{dashboardData.length} student submissions reviewed.</p>
              </div>
            </div>
          ) : (<>
          {/* ── Header: Student + Score ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    {student.student_id.slice(-1)}
                  </div>
                  <span className="text-base font-bold text-white">{student.student_id}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{student.paper_id}</span>
                </div>
                <p className="text-xs text-slate-500 ml-9">AI Evaluation Result</p>
              </div>

              {/* Score ring */}
              <div className="text-right shrink-0">
                <div className="text-3xl font-black text-white leading-none">
                  {student.overall_paper_score}
                  <span className="text-lg font-semibold text-slate-500">
                    /{student.maximum_paper_marks}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Overall Score</p>
                <div className="mt-2 h-1.5 w-28 bg-slate-800 rounded-full overflow-hidden ml-auto">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">{scorePercent.toFixed(0)}%</p>
              </div>
            </div>
          </div>

          {/* ── Plagiarism Alert ── */}
          {hasPlagiarism && (() => {
            const pq = student.question_results.find(q => q.plagiarism_flag)
            return (
              <div className="flex items-start gap-3 p-4 bg-red-950/50 border border-red-700/50 rounded-2xl">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-300">Plagiarism Flag Detected</p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    Similarity score: <strong className="text-red-300">{(pq.plagiarism_details.similarity_score * 100).toFixed(0)}%</strong>
                    {' '}· Matched with:{' '}
                    {pq.plagiarism_details.matched_with.map(s => (
                      <span key={s} className="inline-block bg-red-800/50 text-red-200 rounded px-1.5 py-0.5 text-xs font-mono ml-1">{s}</span>
                    ))}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-red-400 bg-red-900/60 border border-red-700/50 px-2 py-1 rounded-lg">
                  REVIEW REQUIRED
                </span>
              </div>
            )
          })()}

          {/* ── Question Results Accordion ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-1">
              Question Results
            </p>

            {student.question_results.map((q, i) => (
              <div key={q.question_id} className="border border-slate-800 rounded-2xl overflow-hidden">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => setOpenQ(p => ({ ...p, [i]: !p[i] }))}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-900/60 hover:bg-slate-900 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-200">{q.question_id}</p>
                      {q.question_text && (
                        <details className="mt-0.5" onClick={e => e.stopPropagation()}>
                          <summary className="text-xs text-slate-600 hover:text-slate-400 cursor-pointer select-none list-none">
                            ▶ View Original Question
                          </summary>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs pr-2">{q.question_text}</p>
                        </details>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          Score: <strong className="text-slate-300">{q.score_awarded}</strong>/{q.max_question_score}
                        </span>
                        {q.format_check_passed && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-800/40 px-1.5 py-0.5 rounded">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Format OK
                          </span>
                        )}
                        {q.plagiarism_flag && (
                          <span className="text-xs text-red-400 bg-red-900/30 border border-red-800/40 px-1.5 py-0.5 rounded">
                            ⚠ Plagiarism
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${openQ[i] ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Accordion Body */}
                {openQ[i] && (
                  <div className="px-5 py-4 space-y-4 border-t border-slate-800">
                    {/* Justification */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">AI Justification</p>
                      <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3">
                        {q.justification}
                      </p>
                    </div>

                    {/* Grading Breakdown Table */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Grading Breakdown</p>
                      <div className="overflow-hidden border border-slate-800 rounded-xl">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-800/60">
                              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5 w-5/12">Criteria</th>
                              <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5 w-2/12">Points</th>
                              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5 w-5/12">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.grading_breakdown.map((row, ri) => (
                              <tr key={ri} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 text-slate-300 text-xs leading-relaxed">{row.criteria}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-block bg-blue-600/20 text-blue-300 border border-blue-500/20 rounded-lg px-2 py-0.5 text-xs font-mono font-semibold">
                                    +{row.points_awarded}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-xs leading-relaxed">{row.notes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>)}
        </div>

        {/* ── Sticky Action Bar ── */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm px-5 py-4">
          <div className="flex items-center gap-3">
            {/* Progress counter + Approve button */}
            <span className="text-xs text-slate-600 shrink-0 tabular-nums">{Math.min(currentIndex + 1, dashboardData.length)}/{dashboardData.length}</span>
            <button
              id="approve-grade-btn"
              type="button"
              onClick={handleApprove}
              disabled={allDone}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-green-600/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Approve &amp; Next Student
            </button>
            <span className="text-xs text-slate-700 hidden sm:block">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-500 font-mono">⇧ A</kbd>
            </span>

            {/* Divider */}
            <div className="h-7 w-px bg-slate-800 mx-1" />

            {/* Manual Override */}
            <div className="flex items-center gap-2 flex-1">
              <div className="relative">
                <input
                  id="override-input"
                  ref={overrideRef}
                  type="number"
                  min="0"
                  max={student?.maximum_paper_marks}
                  step="0.5"
                  value={overrideScore}
                  onChange={e => setOverrideScore(e.target.value)}
                  placeholder={`Override score (max ${student?.maximum_paper_marks ?? '?'})`}
                  className="
                    bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100
                    placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    focus:border-amber-600/60 transition-all w-56
                  "
                />
              </div>
              <button
                id="save-override-btn"
                type="button"
                onClick={handleSaveOverride}
                disabled={overrideScore === ''}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${savedFeedback ? 'text-green-300 bg-green-600/10 border-green-500/30' : 'text-amber-300 bg-amber-600/10 hover:bg-amber-600/20 border-amber-500/30'}`}
              >
                {savedFeedback ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save
                  </>
                )}
              </button>
              <span className="text-xs text-slate-700 hidden sm:block">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-500 font-mono">⇧ O</kbd> to focus
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root Export ───────────────────────────────────────────────────────────────

export default function ReviewDashboard({ isProcessing, processingLogs, dashboardData, setDashboardData, currentIndex, setCurrentIndex }) {
  if (isProcessing) {
    return <LoadingView processingLogs={processingLogs} />
  }
  return (
    <DashboardView
      dashboardData={dashboardData}
      setDashboardData={setDashboardData}
      currentIndex={currentIndex}
      setCurrentIndex={setCurrentIndex}
    />
  )
}
