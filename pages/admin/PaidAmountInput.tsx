
import React, { useState, useEffect } from 'react';

interface PaidAmountInputProps {
  value?: number;
  onSave: (val: number) => void;
}

const PaidAmountInput: React.FC<PaidAmountInputProps> = ({ value, onSave }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '0');

  useEffect(() => {
    setLocalValue(value?.toString() || '0');
  }, [value]);

  const handleBlur = () => {
    const num = parseInt(localValue);
    if (!isNaN(num) && num !== (value || 0)) {
      onSave(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      className="border rounded px-2 py-1 w-24 text-sm focus:ring-1 focus:ring-red-500 outline-none transition-all text-right"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="0"
    />
  );
};

export default PaidAmountInput;
