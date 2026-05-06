'use client'

import { motion } from 'framer-motion'

const milestones = [
  { time: '11:47 PM', label: 'Agent Deployed', value: '$25', color: '#64748b' },
  { time: '11:52 PM', label: 'First Profit', value: '$47', color: '#00ff41' },
  { time: '12:15 AM', label: '10x Growth', value: '$250', color: '#00ff41' },
  { time: '2:30 AM', label: '50x Growth', value: '$1,250', color: '#f59e0b' },
  { time: '6:00 AM', label: '169x Return', value: '$4,237', color: '#00ff41' },
]

export function DeploymentTimeline() {
  return (
    <div className="relative flex items-center justify-between gap-0 px-2 py-3">
      {/* Connecting line */}
      <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-[#64748b] via-[#00ff41]/40 to-[#00ff41]" />

      {milestones.map((milestone, i) => {
        const isLast = i === milestones.length - 1
        return (
          <motion.div
            key={milestone.label}
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
          >
            {/* Pulsing dot for last milestone */}
            {isLast ? (
              <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
              </div>
            ) : (
              <div
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  borderColor: milestone.color,
                  backgroundColor: milestone.color + '33',
                }}
              />
            )}
            <span className="mt-1.5 whitespace-nowrap text-[9px] font-mono text-[#64748b]">
              {milestone.time}
            </span>
            <span className="whitespace-nowrap text-[9px] font-medium text-[#94a3b8]">
              {milestone.label}
            </span>
            <span
              className="whitespace-nowrap text-[10px] font-bold font-mono"
              style={{ color: milestone.color }}
            >
              {milestone.value}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
