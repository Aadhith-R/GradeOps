import { useState, useCallback, useEffect } from 'react'
import './index.css'
import RubricBuilder from './components/RubricBuilder'
import ReviewDashboard from './components/ReviewDashboard'

// ── Mock Pipeline Logs ────────────────────────────────────────────────────────
const MOCK_LOGS = [
  '[System] Received submission: EXAM_FINAL_01',
  '[System] Extracting PDF pages (3 found)...',
  '[Vision] Running OCR on student scan STU_404...',
  '[Vision] OCR complete — confidence: 94.2%',
  '[Agent] Evaluating Q_101 against rubric...',
  '[Agent] Running plagiarism detection across cohort...',
  '[Status] All evaluations complete.',
  '[Status] ✓ Pipeline finished. Ready for TA review.',
]

const API_BASE = 'http://localhost:8000'

// ── Sidebar ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ activeView, setActiveView, dashboardData, currentIndex, onStudentClick, onReset, approvedStudentIds, visitedStudentIds, recentPapers, onPaperClick }) {
  const pending = dashboardData.length - approvedStudentIds.size

  const navItem = (view, icon, label, badge) => {
    const active = activeView === view
    return (
      <button
        type="button"
        onClick={() => setActiveView(view)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group
          ${active
            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
          }
        `}
      >
        <svg className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-300'} transition-colors`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
        <span className="flex-1 text-left">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-xs bg-red-600/80 text-red-100 px-1.5 py-0.5 rounded-full font-semibold leading-none">
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-slate-950 border-r border-slate-800/70 z-20">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800/70">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight tracking-tight">GradeOps</p>
          <p className="text-xs text-slate-500 leading-tight">AI Grading Platform</p>
        </div>
      </div>

      {/* New Paper CTA */}
      <div className="px-3 py-3 border-b border-slate-800/70">
        <button
          id="new-paper-btn"
          type="button"
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-md shadow-blue-600/20 transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Paper
        </button>
      </div>

      {/* Nav: Views */}
      <div className="px-3 pt-3 pb-1 space-y-0.5">
        <p className="px-2 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest">Workspace</p>
        {navItem(
          'builder',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
          'Rubric Builder',
        )}
        {navItem(
          'dashboard',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
          'TA Dashboard',
          pending,
        )}
      </div>

      {/* Scrollable middle section */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1
        [&::-webkit-scrollbar]:w-1
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {/* Pending Reviews — only when dashboard is active */}
        {activeView === 'dashboard' && (
          <details open className="group/pending">
            <summary className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest cursor-pointer select-none list-none hover:text-slate-400 transition-colors">
              <span>Pending Reviews</span>
              <svg className="w-3 h-3 transition-transform group-open/pending:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <nav className="mt-0.5 space-y-0.5">
              {dashboardData.map((s, idx) => {
                const isActive   = idx === currentIndex
                const isApproved = approvedStudentIds.has(s.student_id)
                const isVisited  = visitedStudentIds.has(s.student_id)
                return (
                  <button
                    key={s.student_id}
                    type="button"
                    onClick={() => onStudentClick(idx, s.student_id)}
                    className={`
                      w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all
                      ${isActive
                        ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }
                    `}
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                        isApproved ? 'bg-green-600/30 text-green-400' 
                      : isVisited  ? 'bg-slate-700/50 text-slate-400'
                      : isActive   ? 'bg-blue-600/30 text-blue-300' 
                      : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                    }`}>
                      {isApproved ? '\u2713' : isVisited ? '\u2022' : idx + 1}
                    </span>
                    <span className="truncate font-medium">{s.student_id}</span>
                    {s.question_results?.some(q => q.plagiarism_flag) && (
                      <span className="ml-auto text-xs text-red-400 shrink-0">⚠</span>
                    )}
                  </button>
                )
              })}
            </nav>
          </details>
        )}

        {/* Recent Papers — collapsible */}
        <details open className="group/recent">
          <summary className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest cursor-pointer select-none list-none hover:text-slate-400 transition-colors">
            <span>Recent Papers</span>
            <svg className="w-3 h-3 transition-transform group-open/recent:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <nav className="mt-0.5 space-y-0.5">
            {recentPapers.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-600 italic">No rubrics found.</p>
            )}
            {recentPapers.map(paper => (
              <button
                key={paper.paper_id || paper._id}
                type="button"
                onClick={() => onPaperClick(paper.paper_id)}
                className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/70 active:bg-slate-800 group transition-colors duration-100 border border-transparent"
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm text-slate-300 group-hover:text-white truncate transition-colors leading-tight">{paper.paper_id}</p>
                  <p className="text-xs text-slate-600 group-hover:text-slate-500 transition-colors mt-0.5">{paper.total_questions} questions · {paper.maximum_paper_marks} pts</p>
                </div>
              </button>
            ))}
          </nav>
        </details>
      </div>

      {/* Bottom: Settings + Profile */}
      <div className="px-3 py-3 border-t border-slate-800/70 space-y-0.5">
        <button id="settings-btn" type="button" title="Coming Soon..."
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all group">
          <svg className="w-4 h-4 shrink-0 text-slate-600 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
        <button id="profile-btn" type="button" title="Coming Soon..."
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/70 transition-all group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 text-xs font-bold text-white shadow">A</div>
          <div className="text-left min-w-0">
            <p className="text-sm text-slate-300 group-hover:text-white truncate transition-colors leading-tight">John Smith</p>
            <p className="text-xs text-slate-600 truncate">Teacher</p>
          </div>
        </button>
      </div>
    </aside>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [activeView, setActiveView]         = useState('builder')
  const [isProcessing, setIsProcessing]     = useState(false)
  const [processingLogs, setProcessingLogs] = useState([])
  const [dashboardData, setDashboardData]   = useState([])
  const [currentIndex, setCurrentIndex]     = useState(0)
  const [resetCounter, setResetCounter]     = useState(0)
  const [approvedStudentIds, setApprovedStudentIds] = useState(new Set())
  const [visitedStudentIds, setVisitedStudentIds]   = useState(new Set())
  const [recentPapers, setRecentPapers]             = useState([])
  const [activePaperId, setActivePaperId]           = useState(null)

  // Hydrate sidebar: fetch rubric metadata on mount
  useEffect(() => {
    fetch(`${API_BASE}/rubrics`)
      .then(res => res.json())
      .then(data => setRecentPapers(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch rubrics:', err))
  }, [])

  // Load grades for a specific paper (called from sidebar)
  const fetchGradesForPaper = useCallback(async (paperId) => {
    try {
      const res = await fetch(`${API_BASE}/grades/${paperId}`)
      if (!res.ok) throw new Error('Failed to fetch grades')
      const data = await res.json()
      setDashboardData(Array.isArray(data) ? data : [data])
      setCurrentIndex(0)
      setApprovedStudentIds(new Set())
      setVisitedStudentIds(new Set())
      setActivePaperId(paperId)
      setActiveView('dashboard')
    } catch (err) {
      console.error('[GradeOps] Failed to load grades:', err)
    }
  }, [])

  const handleStudentClick = useCallback((idx, studentId) => {
    setCurrentIndex(idx)
    setActiveView('dashboard')
    setVisitedStudentIds(prev => new Set([...prev, studentId]))
  }, [])

  // ── Mock streaming fallback ────────────────────────────────────────────────
  const runMockStream = useCallback(() => {
    let idx = 0
    // I sped this up from 7500ms to 800ms so you don't fall asleep testing UI!
    const iv = setInterval(() => {
      setProcessingLogs(prev => {
        if (idx < MOCK_LOGS.length) return [...prev, MOCK_LOGS[idx]]
        return prev
      })
      idx++
      if (idx >= MOCK_LOGS.length) clearInterval(iv)
    }, 800) 

    setTimeout(() => {
      clearInterval(iv)
      setIsProcessing(false)
      // Mock stream animation complete — real API response already handled dashboardData
    }, 7000) 
  }, [])

  // ── Global reset handler ───────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setActiveView('builder')
    setIsProcessing(false)
    setProcessingLogs([])
    setDashboardData([])
    setCurrentIndex(0)
    setApprovedStudentIds(new Set())
    setVisitedStudentIds(new Set())
    setActivePaperId(null)
    setResetCounter(c => c + 1)  // forces RubricBuilder unmount+remount via key prop
  }, [])

  // ── Approve handler (ID-based, schema-safe) ───────────────────────────────────
  const handleApprove = useCallback((studentId) => {
    setApprovedStudentIds(prev => new Set([...prev, studentId]))
    setCurrentIndex(i => i + 1)
  }, [])

  // ── Primary submission handler ────────────────────────────────────────────
  const startProcessing = useCallback(async (examPayload, examFile) => {
    // Switch to dashboard loading state immediately
    setActiveView('dashboard')
    setIsProcessing(true)
    setProcessingLogs([])
    setCurrentIndex(0)

    // Build multipart payload matching teammate's EXACT specification
    const formData = new FormData()
    formData.append('student_id', 'STU_404') // Placeholder ID added
    formData.append('paper_json', JSON.stringify(examPayload)) // Changed from rubric_json
    formData.append('exam_pdf', examFile)

    try {
      // Switched to new /grade-pdf endpoint
      const res = await fetch('http://127.0.0.1:8000/grade-pdf', {
        method: 'POST',
        body: formData,
        // NOTE: Do NOT set Content-Type — browser must set multipart boundary
      })
      
      if (!res.ok) throw new Error("Backend connection failed")

      const data = await res.json()
      // Real backend response: update dashboard with live results
      setDashboardData(Array.isArray(data) ? data : [data])
      setIsProcessing(false)
    } catch {
      console.warn('Backend connection failed. Falling back to mock data transition.')
      runMockStream()
    }
  }, [runMockStream])

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        dashboardData={dashboardData}
        currentIndex={currentIndex}
        onStudentClick={handleStudentClick}
        onReset={handleReset}
        approvedStudentIds={approvedStudentIds}
        visitedStudentIds={visitedStudentIds}
        recentPapers={recentPapers}
        onPaperClick={fetchGradesForPaper}
      />

      <main className="flex-1 ml-64 flex flex-col overflow-hidden">

        {/* Rubric Builder — always mounted, hidden via CSS when not active */}
        <div className={activeView === 'builder' ? 'flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'hidden'}>
          <div className="max-w-4xl mx-auto px-8 py-10">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white tracking-tight">GRADING RUBRIC</h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Configure exam papers and generate evaluation schema JSON.
              </p>
            </div>
            <RubricBuilder key={resetCounter} onSubmit={startProcessing} isProcessing={isProcessing} />
          </div>
        </div>

        {/* Review Dashboard — always mounted, hidden via CSS when not active */}
        <div className={activeView !== 'builder' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
          <ReviewDashboard
            isProcessing={isProcessing}
            processingLogs={processingLogs}
            dashboardData={dashboardData}
            setDashboardData={setDashboardData}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            onApprove={handleApprove}
            isApproved={dashboardData[currentIndex] ? approvedStudentIds.has(dashboardData[currentIndex].student_id) : false}
          />
        </div>

      </main>
    </div>
  )
}

export default App
