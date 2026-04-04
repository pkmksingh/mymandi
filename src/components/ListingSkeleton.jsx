import { motion } from 'framer-motion';

export function ListingSkeleton() {
  return (
    <div className="glass-panel" style={{ overflow: 'hidden', height: '140px', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100px', height: '100%', background: 'var(--surface-light)', position: 'relative', overflow: 'hidden' }}>
        <motion.div 
          animate={{ x: ['-100%', '100%'] }} 
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          style={{ width: '100%', height: '100%', position: 'absolute', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} 
        />
      </div>
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ width: '40px', height: '12px', borderRadius: '4px', background: 'var(--surface-light)' }} />
        <div style={{ width: '60%', height: '18px', borderRadius: '4px', background: 'var(--surface-light)' }} />
        <div style={{ width: '30%', height: '14px', borderRadius: '4px', background: 'var(--surface-light)' }} />
        <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', marginTop: 'auto' }} />
        <div style={{ width: '80%', height: '10px', borderRadius: '4px', background: 'var(--surface-light)' }} />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
      {[...Array(6)].map((_, i) => <ListingSkeleton key={i} />)}
    </div>
  );
}
