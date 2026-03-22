import { useState, useEffect } from 'react'
import { getPITracker, savePITracker } from '../lib/storage.js'

const PI_DATA = {
  'Business Law': [
    'Comply with laws and regulations','Discuss nature of law / US sources','Describe US judicial system',
    'Describe IP protection methods','Describe legal issues affecting businesses','Identify basic business torts',
    'Describe legally binding contracts','Describe nature of legal procedure','Discuss debtor-creditor relationships',
    'Explain agency relationships','Discuss environmental law','Discuss role of administrative law',
    'Explain types of business ownership','Explain import/export law','Describe customs regulations',
  ],
  'Communications': [
    'Identify valid written sources','Extract info from written materials','Apply written directions to tasks',
    'Explain communication that supports a speaker','Follow oral directions','Demonstrate active listening',
    'Explain effective verbal communication','Ask relevant questions','Interpret nonverbal cues',
    'Provide legitimate responses to inquiries','Defend ideas objectively','Handle telephone calls professionally',
    'Participate in group discussions','Facilitate group discussions','Make oral presentations',
    'Utilize note-taking strategies','Organize information','Select and use graphic aids',
    'Explain effective written communications','Write professional emails','Write business letters',
    'Write informational messages','Write persuasive messages','Write executive summaries',
    'Prepare simple written reports','Explain digital communications risk','Adapt written correspondence to audience',
    'Use data visualization techniques','Describe social media brand impact','Distinguish social media business vs personal',
    'Explain staff communication','Choose appropriate communication channel','Participate in staff meetings',
  ],
  'Customer Relations': [
    'Explain positive customer relations','Demonstrate customer service mindset','Develop rapport with customers',
    'Reinforce service orientation through communication','Respond to customer inquiries',
    'Adapt communication to cultural differences','Interpret business policies to customers',
    'Build and maintain customer relationships','Handle difficult customers','Handle customer complaints',
    'Identify company brand promise','Determine ways to reinforce company image',
    'Discuss CRM nature','Explain ethics in CRM','Describe technology in CRM',
  ],
  'Economics': [
    'Distinguish economic goods and services','Explain concept of economic resources',
    'Describe economics and economic activities','Determine economic utilities',
    'Explain supply and demand','Describe functions of prices',
    'Explain role of business in society','Describe types of business activities',
    'Describe types of business models','Explain organizational design of businesses',
    'Explain types of economic systems','Explain concept of private enterprise',
    'Identify factors affecting profit','Determine factors affecting business risk',
    'Explain concept of competition','Determine government-business relationship',
    'Describe nature of taxes','Explain concept of productivity',
    'Explain division of labor / specialization','Explain organized labor and business',
    'Explain law of diminishing returns','Discuss consumer spending as indicator',
    'Describe economic impact of inflation','Explain GDP concept',
    'Discuss unemployment rate impact','Explain interest-rate fluctuations',
    'Determine impact of business cycles','Explain nature of global trade',
    'Discuss impact of globalization','Describe exchange rate determinants',
    'Explain cultural considerations in global business','Discuss cultural/social environments on trade',
    'Describe electronic communication impact on global business',
    'Explain impact of major trade alliances','Describe political environment on world trade',
    'Explain impact of geography on world trade','Describe country history impact on world trade',
    'Explain country economic development on world trade','Discuss bribery and foreign payments',
    'Identify international business travel requirements',
  ],
  'Emotional Intelligence': [
    'Describe nature of emotional intelligence','Explain concept of self-esteem',
    'Recognize and overcome biases/stereotypes','Assess personal strengths and weaknesses',
    'Assess personal behavior and values','Identify desirable personality traits',
    'Exhibit self-confidence','Demonstrate interest and enthusiasm','Demonstrate initiative',
    'Demonstrate honesty and integrity','Demonstrate responsible behavior','Demonstrate fairness',
    'Assess risks of personal decisions','Demonstrate ethical work habits',
    'Take responsibility for decisions and actions','Build trust in relationships',
    'Describe nature of ethics','Explain reasons for ethical dilemmas',
    'Recognize and respond to ethical dilemmas','Manage commitments in timely manner',
    'Develop tolerance for ambiguity','Exhibit positive attitude','Demonstrate self-control',
    'Explain use of feedback for personal growth','Adjust to change',
    'Show empathy for others','Maintain confidentiality','Exhibit cultural sensitivity',
    'Leverage personality types in business','Sell ideas to others','Persuade others',
    'Demonstrate negotiation skills','Use conflict-resolution skills','Explain nature of stress management',
    'Use consensus-building skills','Motivate team members','Explain concept of leadership',
    'Model ethical behavior','Determine personal vision','Inspire others','Demonstrate adaptability',
    'Develop achievement orientation','Challenge the status quo','Lead change',
    'Enlist others toward shared vision','Coach others','Recognize/reward others',
    'Foster positive working relationships','Assess long-term value of actions',
    'Explain organizational culture','Interpret and adapt to business culture',
  ],
  'Entrepreneurship': [
    'Describe nature of entrepreneurship','Explain role requirements of entrepreneurs',
    'Describe business ethics in entrepreneurship','Describe small-biz opportunities in intl trade',
  ],
  'Financial Analysis': [
    'Explain forms of financial exchange','Identify types of currency','Describe functions of money',
    'Describe sources of income and compensation','Explain time value of money',
    'Explain purposes and importance of credit','Explain legal responsibilities for consumer financial products',
    'Explain need to save and invest','Set financial goals','Develop personal budget',
    'Determine personal net worth','Explain nature of tax liabilities','Maintain financial records',
    'Balance a bank account','Manage online accounts','Calculate cost of credit',
    'Demonstrate wise use of credit','Validate credit history','Protect against identity theft',
    'Control debt','Prepare personal income tax forms','Discuss college financing options',
    'Discuss nature of retirement planning','Explain nature of estate planning',
    'Describe types of financial-services providers','Explain types of investments',
    'Describe concept of insurance','Determine insurance needs',
    'Describe need for financial information','Explain concept of accounting',
    'Discuss role of ethics in accounting','Explain use of technology in accounting',
    'Explain legal considerations for accounting',
    'Describe nature of cash flow statements','Explain nature of balance sheets',
    'Describe nature of income statements','Explain role of finance in business',
    'Discuss role of ethics in finance','Explain legal considerations for finance',
    'Describe nature of budgets',
  ],
  'Human Resources Management': [
    'Discuss nature of human resources management',
    'Explain role of ethics in HRM','Describe use of technology in HRM','Orient new employees',
  ],
  'Information Management': [
    'Assess information needs','Obtain needed information efficiently',
    'Evaluate quality and source of information','Draw conclusions from information analysis',
    'Apply information to accomplish a task','Store information for future use',
    'Discuss nature of information management','Explain role of ethics in information management',
    'Explain legal issues in information management',
    'Identify ways technology impacts business','Explain role of information systems',
    'Discuss principles of computer systems','Demonstrate basic spreadsheet applications',
    'Demonstrate basic database applications','Demonstrate basic word processing skills',
    'Use integrated software application package','Demonstrate collaborative/groupware applications',
    'Describe nature of business records','Describe current business trends',
    'Monitor internal records for business information','Conduct environmental scan',
  ],
  'Marketing': [
    'Explain marketing importance in global economy','Describe marketing functions and activities',
    'Explain factors influencing buying behavior','Discuss employee actions to achieve results',
    'Demonstrate connections between company actions and results',
  ],
  'Operations': [
    'Explain nature of operations management','Develop and implement policies and procedures',
    'Explain project management','Understand quality management',
    'Manage workplace safety','Manage supply chain and inventory',
  ],
  'Professional Development': [
    'Manage personal career development','Maintain professional image',
    'Develop resume and employment documents','Build professional network',
    'Identify requirements for international business travel',
  ],
  'Risk Management': [
    'Describe concept of risk management','Identify types of business risk',
    'Apply risk management strategies','Use insurance as risk management tool',
    'Understand enterprise risk management (ERM)',
  ],
  'Strategic Management': [
    'Explain nature of strategic management','Conduct SWOT analysis',
    'Develop and implement business strategy','Understand organizational design',
    'Manage positive organizational culture',
  ],
}

export default function PITracker({ user }) {
  const [tracker,  setTracker]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState({})
  const [filter,   setFilter]   = useState('all')

  useEffect(() => {
    getPITracker().then(d=>{ setTracker(d||{}); setLoading(false) })
  }, [])

  async function togglePI(pi) {
    const cur = tracker[pi]
    const next = cur?.checked ? null : { checked:true, checkedBy:user.name, checkedAt:new Date().toISOString() }
    const updated = { ...tracker }
    if (next) updated[pi] = next; else delete updated[pi]
    setTracker(updated)
    setSaving(true)
    try { await savePITracker(updated) } catch {}
    setSaving(false)
  }

  const allPIs    = Object.values(PI_DATA).flat()
  const checked   = Object.keys(tracker).length
  const total     = allPIs.length
  const overall   = Math.round(checked / total * 100)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-on-surface-variant text-sm">Loading team progress…</p>
    </div>
  )

  return (
    <div className="bg-surface min-h-full pb-4">
      {/* Header */}
      <div className="bg-background px-5 pt-12 pb-5 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined sym-filled text-primary text-[22px]">leaderboard</span>
            <h1 className="text-primary font-black tracking-tighter text-xl">PI Tracker</h1>
          </div>
          <span className="text-on-surface-variant text-sm font-medium">
            {saving ? 'Saving…' : 'Team View'}
          </span>
        </div>

        {/* Overall coverage */}
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-on-surface-variant text-[11px] font-bold uppercase tracking-widest">Overall Coverage</p>
            <h2 className="text-5xl font-black text-primary tracking-tighter">{overall}%</h2>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary-container/30 rounded-full mb-1">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-[11px] font-bold text-on-secondary-container uppercase tracking-wider">Synced</span>
          </div>
        </div>
        <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{width:`${overall}%`}} />
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {/* Filter pills */}
        <div className="flex gap-2">
          {[['all','All'],['incomplete','Remaining'],['complete','Done']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95
                ${filter===v?'bg-primary text-on-primary shadow-md':'bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">PIs covered</p>
            <p className="text-xl font-bold text-on-surface">{overall}%</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Remaining</p>
            <p className="text-xl font-bold text-on-surface">{total - checked} PIs</p>
          </div>
        </div>

        {/* Chapter list */}
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          <div className="px-5 py-4 border-b border-surface-container flex justify-between items-center">
            <h3 className="font-bold text-primary tracking-tight">Performance Indicators</h3>
            <span className="material-symbols-outlined text-outline text-[20px]">filter_list</span>
          </div>

          {Object.entries(PI_DATA).map(([chapter, pis], chIdx) => {
            const chChecked = pis.filter(pi => tracker[pi]?.checked).length
            const chPct     = Math.round(chChecked / pis.length * 100)
            const isOpen    = expanded[chapter]
            const barColor  = chPct>=75?'bg-primary':chPct>=40?'bg-primary/60':'bg-primary/30'

            const filtered = pis.filter(pi => {
              if (filter==='complete')   return tracker[pi]?.checked
              if (filter==='incomplete') return !tracker[pi]?.checked
              return true
            })
            if (filter !== 'all' && filtered.length === 0) return null

            return (
              <div key={chapter} className={chIdx < Object.keys(PI_DATA).length-1 ? 'border-b border-surface-container' : ''}>
                <button onClick={()=>setExpanded(e=>({...e,[chapter]:!e[chapter]}))}
                  className="w-full px-5 py-4 flex items-center gap-3 hover:bg-surface-container-low transition-colors active:bg-surface-container-low">
                  <div className="flex-1 text-left">
                    <p className="font-bold text-on-surface text-sm mb-2">{chapter}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{width:`${chPct}%`}} />
                      </div>
                      <span className="text-[11px] font-bold text-primary flex-shrink-0">{chChecked}/{pis.length}</span>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-outline-variant text-[20px] transition-transform ${isOpen?'rotate-90':''}`}>
                    chevron_right
                  </span>
                </button>

                {isOpen && filtered.map(pi => {
                  const done = tracker[pi]?.checked
                  const by   = tracker[pi]?.checkedBy
                  return (
                    <div key={pi} className="flex items-center gap-3 px-5 py-3 border-t border-surface-container bg-surface-container-low/50">
                      <button onClick={()=>togglePI(pi)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90
                          ${done?'bg-secondary text-on-secondary':'border-2 border-outline-variant/40'}`}>
                        {done && <span className="material-symbols-outlined sym-filled text-[14px]">check</span>}
                      </button>
                      <p className={`text-sm flex-1 leading-snug ${done?'text-on-surface-variant line-through':'text-on-surface'}`}>{pi}</p>
                      {done && by && <span className="text-[11px] text-outline flex-shrink-0">{by.split(' ')[0]}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
