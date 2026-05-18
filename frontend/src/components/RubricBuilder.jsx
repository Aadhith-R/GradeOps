import { useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESETS = {
  stem:         { label: 'STEM Problem',  config: { answer_format: 'step_wise',   sentence_formation_required: false, partial_credit_enabled: true,  strict_ordering: true  } },
  essay:        { label: 'Essay',         config: { answer_format: 'descriptive', sentence_formation_required: true,  partial_credit_enabled: true,  strict_ordering: false } },
  short_answer: { label: 'Short Answer',  config: { answer_format: 'keyword',     sentence_formation_required: false, partial_credit_enabled: false, strict_ordering: false } },
  custom:       { label: 'Custom',        config: { answer_format: 'step_wise',   sentence_formation_required: false, partial_credit_enabled: true,  strict_ordering: false } },
}

const DOMAINS       = ['STEM', 'Humanities', 'Custom']
const ANSWER_FMTS   = ['step_wise', 'keyword', 'descriptive']

let _uid = 0
const uid = () => ++_uid
const mkCond = ()     => ({ id: uid(), criteria: '', points: '' })
const mkQuestion = (defaultId = '') => ({
  id: uid(), collapsed: false,
  question_id: defaultId, question_text: '', max_score: '',
  question_type: 'stem',
  evaluation_config: { ...PRESETS.stem.config },
  conditions: [mkCond()],
  teacher_solution: { exact_answer: '', required_steps: [] },
  showSolution: false,
})

// ── Shared Atoms ──────────────────────────────────────────────────────────────

const Label = ({ children }) => (
  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">{children}</p>
)

const inputCls = 'w-full bg-slate-800/60 border border-slate-600/60 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all'

const SelectArrow = () => (
  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
)

const ReadonlyPill = ({ label, value }) => (
  <span className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs">
    <span className="text-slate-500">{label}:</span>
    <span className="text-slate-200 font-medium">{String(value)}</span>
  </span>
)

let _toggleId = 0
function Toggle({ checked, onChange, label }) {
  const id = `toggle-${++_toggleId}`
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between py-1.5 cursor-pointer group"
    >
      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors select-none">
        {label}
      </span>
      <div className="relative flex items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className="
            w-9 h-5 rounded-full border transition-colors duration-200
            bg-slate-700 border-slate-600
            peer-checked:bg-blue-600 peer-checked:border-blue-500
            peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-slate-800
          "
        />
        <div
          className="
            absolute left-0.5 w-4 h-4 rounded-full bg-white shadow
            transition-transform duration-200
            peer-checked:translate-x-4
          "
        />
      </div>
    </label>
  )
}

// ── EvalConfig: badges (preset) or editable controls (custom) ─────────────────

function EvalConfigSection({ isCustom, config, onChange }) {
  
  // 1. Translate the ugly snake_case keys into human-readable labels
  const keyFormatter = {
    answer_format: "FORMAT",
    sentence_formation_required: "FULL SENTENCES",
    partial_credit_enabled: "PARTIAL CREDIT",
    strict_ordering: "STRICT ORDER"
  };

  // 2. Translate the values (turning booleans into Yes/No, and cleaning up strings)
  const valueFormatter = (val) => {
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (val === 'step_wise') return 'Step-by-Step';
    if (val === 'bullet_points') return 'Bullets';
    if (val === 'keyword') return 'Keyword';
    if (val === 'descriptive') return 'Descriptive';
    return val; // Fallback for anything else
  };

  if (!isCustom) {
    return (
      <div className="flex flex-wrap gap-2 mt-2.5">
        {Object.entries(config).map(([k, v]) => (
          <ReadonlyPill 
            key={k} 
            label={keyFormatter[k] || k} 
            value={valueFormatter(v)} 
          />
        ))}
      </div>
    )
  }
  return (
    <div className="mt-3 p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Custom Evaluation Config</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Answer Format</span>
        <select
          value={config.answer_format}
          onChange={e => onChange('answer_format', e.target.value)}
          className="bg-slate-800 border border-slate-600/60 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {ANSWER_FMTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <Toggle checked={config.sentence_formation_required} onChange={v => onChange('sentence_formation_required', v)} label="Sentence Formation Required" />
      <Toggle checked={config.partial_credit_enabled}      onChange={v => onChange('partial_credit_enabled', v)}      label="Partial Credit Enabled" />
      <Toggle checked={config.strict_ordering}             onChange={v => onChange('strict_ordering', v)}             label="Strict Step Ordering" />
    </div>
  )
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

function QuestionCard({ question, index, onUpdate, onRemove }) {
  const isCustom     = question.question_type === 'custom'
  const lastCond     = question.conditions[question.conditions.length - 1]
  const addCondDisabled = !lastCond?.criteria?.trim() || lastCond?.points === '' || lastCond?.points == null

  const set = (field, value) => onUpdate(q => ({ ...q, [field]: value }))

  const handleTypeChange = e => {
    const key = e.target.value
    onUpdate(q => ({ ...q, question_type: key, evaluation_config: { ...PRESETS[key].config } }))
  }

  const updateEval = (field, value) =>
    onUpdate(q => ({ ...q, evaluation_config: { ...q.evaluation_config, [field]: value } }))

  const addCond = () =>
    onUpdate(q => ({ ...q, conditions: [...q.conditions, mkCond()] }))

  const removeCond = id =>
    onUpdate(q => ({ ...q, conditions: q.conditions.filter(c => c.id !== id) }))

  const updateCond = (id, field, value) =>
    onUpdate(q => ({ ...q, conditions: q.conditions.map(c => c.id === id ? { ...c, [field]: value } : c) }))

  return (
    <div className="border border-slate-700/50 rounded-2xl overflow-hidden bg-slate-900/50 shadow-md shadow-black/20">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => set('collapsed', !question.collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-800/50 hover:bg-slate-800/80 transition-colors duration-150 group"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-bold">
            {index + 1}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-200 leading-tight">
              {question.question_id || `Question ${index + 1}`}
            </p>
            <p className="text-xs text-slate-500">
              {PRESETS[question.question_type].label} · {question.max_score || '0'} pts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${question.collapsed ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {!question.collapsed && (
        <div className="px-5 py-5 space-y-5">

          {/* Question Type */}
          <div>
            <Label>Question Type</Label>
            <div className="relative">
              <select
                value={question.question_type}
                onChange={handleTypeChange}
                className={`${inputCls} appearance-none pr-9 cursor-pointer`}
              >
                {Object.entries(PRESETS).map(([key, { label }]) => (
                  <option key={key} value={key} className="bg-slate-800">{label}</option>
                ))}
              </select>
              <SelectArrow />
            </div>
            <EvalConfigSection isCustom={isCustom} config={question.evaluation_config} onChange={updateEval} />
          </div>

          {/* Question ID + Max Score */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Question ID</Label>
              <input
                type="text"
                value={question.question_id}
                onChange={e => set('question_id', e.target.value)}
                placeholder="e.g. Q-001"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Max Score</Label>
              <input
                type="number"
                min="0"
                value={question.max_score}
                onChange={e => set('max_score', Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* Question Text */}
          <div>
            <Label>Question Text</Label>
            <textarea
              rows={3}
              value={question.question_text}
              onChange={e => set('question_text', e.target.value)}
              placeholder="Enter the full question prompt…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Teacher Reference Solution (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => set('showSolution', !question.showSolution)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors duration-150"
            >
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${question.showSolution ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              {question.showSolution ? '− Hide Solution' : '+ Add Solution (Optional)'}
            </button>

            {question.showSolution && (
              <div className="mt-2.5">
                <textarea
                  rows={4}
                  value={question.teacher_solution.exact_answer}
                  onChange={e =>
                    onUpdate(q => ({
                      ...q,
                      teacher_solution: { ...q.teacher_solution, exact_answer: e.target.value },
                    }))
                  }
                  placeholder="Enter the definitive correct answer, reference text, or step-by-step solution here..."
                  className="
                    w-full bg-slate-800/50 border border-emerald-800/40 rounded-xl px-3.5 py-2.5
                    text-slate-200 placeholder-slate-600 text-sm resize-none
                    focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-700/60
                    transition-all
                  "
                />
                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Used as ground-truth context during AI evaluation. Not shown to students.
                </p>
              </div>
            )}
          </div>

          {/* Rubric Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Rubric Conditions</Label>
              <button
                type="button"
                onClick={addCond}
                disabled={addCondDisabled}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Condition
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_32px] gap-2 px-1 mb-1">
                <span className="text-xs text-slate-600 uppercase tracking-wide">Criteria</span>
                <span className="text-xs text-slate-600 uppercase tracking-wide text-center">Points</span>
                <span />
              </div>
              {question.conditions.map((cond, i) => (
                <div key={cond.id} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={cond.criteria}
                    onChange={e => updateCond(cond.id, 'criteria', e.target.value)}
                    placeholder={`Condition ${i + 1}`}
                    className="bg-slate-800/60 border border-slate-600/60 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all"
                  />
                  <input
                    type="number"
                    min="0"
                    value={cond.points}
                    onChange={e => updateCond(cond.id, 'points', e.target.value)}
                    placeholder="0"
                    className="bg-slate-800/60 border border-slate-600/60 rounded-xl px-2 py-2 text-slate-100 placeholder-slate-600 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removeCond(cond.id)}
                    disabled={question.conditions.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PaperDetailsCard ──────────────────────────────────────────────────────────

function PaperDetailsCard({ paperId, domain, totalQ, maxMarks, onIdChange, onDomainChange }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl shadow-black/30 overflow-hidden">
      <div className="px-7 py-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-900/20 to-slate-800/20 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        <h2 className="text-base font-bold text-white">PAPER DETAILS</h2>
        {/* <span className="ml-auto text-xs text-slate-600">Top-level exam metadata</span> */}
      </div>
      <div className="px-7 py-5 grid grid-cols-2 gap-5">
        <div>
          <Label>Paper ID</Label>
          <input
            id="paper-id"
            type="text"
            value={paperId}
            onChange={e => onIdChange(e.target.value)}
            placeholder="e.g. EXAM-2025-CS01"
            className={inputCls}
          />
        </div>
        <div>
          <Label>Subject Domain</Label>
          <div className="relative">
            <select
              id="subject-domain"
              value={domain}
              onChange={e => onDomainChange(e.target.value)}
              className={`${inputCls} appearance-none pr-9 cursor-pointer`}
            >
              {DOMAINS.map(d => <option key={d} value={d} className="bg-slate-800">{d}</option>)}
            </select>
            <SelectArrow />
          </div>
        </div>
        {/* Read-only computed fields */}
        {[
          { label: 'Total Questions', value: totalQ },
          { label: 'Maximum Paper Marks', value: maxMarks },
        ].map(({ label, value }) => (
          <div key={label}>
            <Label>{label}</Label>
            <div className="flex items-center bg-slate-800/40 border border-slate-700/40 rounded-xl px-3.5 py-2.5">
              <span className="text-slate-300 text-sm font-mono font-semibold">{value}</span>
              <span className="ml-auto text-xs text-slate-600">auto-calculated</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Root: RubricBuilder ───────────────────────────────────────────────────────

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onAttach }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile]         = useState(null)

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  const handleFileInput = e => {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Upload Exam Scans</p>
              <p className="text-xs text-slate-500">PDF files only · Max 50 MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop Zone */}
        <div className="px-6 py-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center gap-3 px-6 py-10
              border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
              ${dragging
                ? 'border-violet-500 bg-violet-600/10'
                : file
                  ? 'border-emerald-600/60 bg-emerald-900/10'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'
              }
            `}
          >
            {file ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-400 truncate max-w-[240px]">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB · Click below to change</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-700/60 border border-slate-600/40">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Drag & drop your PDF here</p>
                  <p className="text-xs text-slate-500 mt-1">or use the button below to browse</p>
                </div>
              </>
            )}
          </div>

          {/* File Input */}
          <label className="mt-3 flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Browse file…
            <input
              id="pdf-file-input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInput}
              className="sr-only"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
          <button
            id="modal-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
          <button
            id="modal-attach-btn"
            type="button"
            disabled={!file}
            onClick={() => { onAttach(file); onClose() }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attach File
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Root: RubricBuilder ───────────────────────────────────────────────────────

export default function RubricBuilder({ onSubmit, isProcessing }) {
  const [paperId, setPaperId]             = useState('')
  const [domain, setDomain]               = useState('STEM')
  // 1. Initialize the first question as Q-1
  const [questions, setQuestions]         = useState([mkQuestion('Q-1')])
  const [copied, setCopied]               = useState(false)
  const [isUploadModalOpen, setUploadModalOpen] = useState(false)
  const [examFile, setExamFile]           = useState(null)
  const [isSubmitting, setIsSubmitting]   = useState(false)

  const totalQ    = questions.length
  const maxMarks  = questions.reduce((s, q) => s + (Number(q.max_score) || 0), 0)

  // 2. Dynamically calculate the next Q-number based on array length
  const addQuestion    = ()  => setQuestions(p => [...p, mkQuestion(`Q-${p.length + 1}`)])
  const removeQuestion = id  => setQuestions(p => p.length > 1 ? p.filter(q => q.id !== id) : p)
  const updateQuestion = (id, fn) => setQuestions(p => p.map(q => q.id === id ? fn(q) : q))

  const buildSchema = () => ({
    paper_id:             paperId.trim() || null,
    subject_domain:       domain,
    total_questions:      totalQ,
    maximum_paper_marks:  maxMarks,
    questions: questions.map(q => ({
      question_id:       q.question_id.trim() || null,
      question_text:     q.question_text.trim() || null,
      max_score:         Number(q.max_score) || 0,
      question_type:     PRESETS[q.question_type].label,
      evaluation_config: { ...q.evaluation_config },
      rubric:            q.conditions
                          .filter(c => c.criteria.trim())
                          .map(c => ({ criteria: c.criteria.trim(), points: Number(c.points) || 0 })),
      teacher_solution: {
        exact_answer:    q.teacher_solution.exact_answer.trim() || null,
        required_steps:  q.teacher_solution.required_steps,
      },
    })),
  })

  const handleSubmit = () => {
    if (isSubmitting) return
    // Validate PDF before locking UI — prevents infinite freeze
    if (!examFile) {
      alert('Please attach a scanned PDF before submitting.')
      return
    }
    setIsSubmitting(true)
    const schema = buildSchema()
    console.log('════════════ GradeOps · Exam Paper Schema ════════════')
    console.log(JSON.stringify(schema, null, 2))
    console.log('📎 Attached scan file:', examFile.name, `(${(examFile.size / 1024 / 1024).toFixed(2)} MB)`)
    console.log('══════════════════════════════════════════════════════')
    // Pass schema + file to parent — parent handles fetch & UI transition
    onSubmit?.(schema, examFile)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(buildSchema(), null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* Paper Details */}
      <PaperDetailsCard
        paperId={paperId}
        domain={domain}
        totalQ={totalQ}
        maxMarks={maxMarks}
        onIdChange={setPaperId}
        onDomainChange={setDomain}
      />

      {/* Questions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-slate-300">
            Questions
            <span className="ml-2 text-xs text-slate-600 font-normal">({totalQ} total)</span>
          </h3>
          <button
            id="add-question-btn"
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </button>
        </div>

        {/* Scrollable accordion list */}
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-slate-700
          [&::-webkit-scrollbar-thumb]:rounded-full">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              onUpdate={fn => updateQuestion(q.id, fn)}
              onRemove={() => removeQuestion(q.id)}
            />
          ))}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Left: Copy + Upload */}
        <div className="flex items-center gap-2">
          <button
            id="copy-json-btn"
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600/60 transition-all"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy JSON
              </>
            )}
          </button>

          <button
            id="upload-scans-btn"
            type="button"
            onClick={() => setUploadModalOpen(true)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border
              text-violet-300 bg-violet-600/10 hover:bg-violet-600/20 border-violet-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {examFile ? (
              <span className="max-w-[120px] truncate">{examFile.name}</span>
            ) : 'Upload Scans (PDF)'}
          </button>
        </div>

        {/* Right: Submit */}
        <button
          id="submit-paper-btn"
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || isProcessing}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 transition-all"
        >
          {isSubmitting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          )}
          {isSubmitting ? 'Submitting…' : 'Submit Paper & Rubrics'}
        </button>
      </div>

      {/* <p className="text-center text-slate-600 text-xs">
        Click <strong className="text-slate-500">Submit Paper &amp; Rubrics</strong> then open DevTools → Console to inspect the schema.
      </p> */}

      {/* PDF Upload Modal */}
      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onAttach={f => setExamFile(f)}
        />
      )}
    </div>
  )
}
