import React from 'react';
import { AlertCircle } from 'lucide-react';

const SyntheticBanner = () => {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs flex items-center justify-between print:hidden">
      <div className="flex items-center space-x-2 font-medium">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Prototype Notice:</strong> All data shown below is <strong>synthetic demonstration data</strong> for evaluation and hackathon display.
        </span>
      </div>
      <span className="hidden md:inline-block bg-amber-200/60 text-amber-800 text-[10px] font-semibold uppercase px-2 py-0.5 rounded tracking-wider">
        Demo Mode
      </span>
    </div>
  );
};

export default SyntheticBanner;
