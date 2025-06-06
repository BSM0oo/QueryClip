import React from 'react';

const BurstModeControls = ({
  burstCount,
  setBurstCount,
  burstInterval,
  setBurstInterval
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Number of Screenshots
        </label>
        <input
          type="number"
          min="2"
          max="10"
          value={burstCount}
          onChange={(e) => setBurstCount(Number(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Interval (seconds)
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={burstInterval}
          onChange={(e) => setBurstInterval(Number(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
    </div>
  );
};

export default BurstModeControls;