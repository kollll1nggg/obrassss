import React, { useCallback, useEffect, useRef, useState } from 'react';

interface RotaryKnobProps {
  label: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  onDoubleClick?: () => void;
}

const RotaryKnob: React.FC<RotaryKnobProps> = ({ label, min = 0, max = 1, value, onChange, onDoubleClick }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const change = (deltaY / 100) * range * 0.75; // Sensitivity adjustment
    let newValue = startValue.current + change;

    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  }, [isDragging, min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const totalRotationRange = 270; // e.g., from -135deg to +135deg
  const range = max - min;
  const rotation = (totalRotationRange * ((value - min) / range)) - (totalRotationRange / 2);

  return (
    <div className="flex flex-col items-center select-none space-y-2">
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={onDoubleClick}
        className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer shadow-inner relative border-2 border-gray-600"
      >
        <div 
          className="absolute w-full h-full"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
             <div className="w-1 h-3 bg-brand-500 rounded-full absolute top-1 left-1/2 -translate-x-1/2"></div>
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
    </div>
  );
};

export default RotaryKnob;
