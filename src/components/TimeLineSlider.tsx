import React, { useContext, useEffect, useState } from 'react';
import ReactSlider from 'react-slider';
import { AppContext } from '../store/context';

interface TimelineSliderProps {
  mode?: 'single' | 'range';
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const TimelineSlider: React.FC<TimelineSliderProps> = ({
  mode = 'range',
  min = 0,
  max = 168,
  step = 1,
  className = ''
}) => {
  const { timeRange, setTimeRange } = useContext(AppContext)!;
  const [localValues, setLocalValues] = useState<number[]>([timeRange.start, timeRange.end]);

  // Update local values when context changes
  useEffect(() => {
    setLocalValues([timeRange.start, timeRange.end]);
  }, [timeRange.start, timeRange.end]);

  const handleChange = (values: number | number[]) => {
    const newValues = Array.isArray(values) ? values : [values, values];
    setLocalValues(newValues);
    
    // Update context immediately for better responsiveness
    if (mode === 'range' && newValues.length === 2) {
      setTimeRange({
        start: Math.min(newValues[0], newValues[1]),
        end: Math.max(newValues[0], newValues[1])
      });
    } else if (mode === 'single') {
      setTimeRange({
        start: newValues[0],
        end: newValues[0]
      });
    }
  };

  const formatTime = (hours: number): string => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days === 0) {
      return `${remainingHours}h`;
    } else if (remainingHours === 0) {
      return `${days}d`;
    } else {
      return `${days}d ${remainingHours}h`;
    }
  };

  const formatTooltip = (value: number): string => {
    return formatTime(value);
  };

  return (
    <div className={`px-6 py-6 bg-gradient-to-br from-slate-50 to-blue-50 border border-gray-200/60 rounded-xl shadow-sm ${className}`}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-semibold text-gray-800">
              Time Range Selection
            </h3>
          </div>
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200/50 shadow-sm">
            {mode === 'range' ? (
              <div className="text-sm font-medium text-gray-700">
                <span className="text-blue-600">{formatTime(localValues[0])}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="text-blue-600">{formatTime(localValues[1])}</span>
                <div className="text-xs text-gray-500 mt-0.5">
                  Duration: {localValues[1] - localValues[0]}h
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-blue-600">{formatTime(localValues[0])}</span>
            )}
          </div>
        </div>
        
        <div className="relative px-4 py-6 bg-white/50 rounded-lg border border-gray-200/30">
          <ReactSlider
            className="w-full h-6 relative"
            thumbClassName="group"
            trackClassName="absolute h-1.5 top-2.5 rounded-full transition-all duration-300 ease-in-out"
            value={mode === 'range' ? localValues : localValues[0]}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            pearling={mode === 'range'}
            withTracks={true}
            renderThumb={(props, state) => (
              <div 
                {...props} 
                className="relative cursor-grab w-6 h-6 bg-gradient-to-br from-white to-blue-400 border-2 border-blue-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-110 active:scale-105 active:cursor-grabbing group"
              >
                <div className="absolute -top-9 left-1/2 transform -translate-x-1/2 bg-gray-800/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  {formatTooltip(state.valueNow)}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-gray-800/90"></div>
                </div>
              </div>
            )}
            renderTrack={(props, state) => {
              const isActiveTrack = mode === 'range' && state.index === 1;
              return (
                <div
                  {...props}
                  className={`absolute h-1.5 top-2.5 rounded-full transition-all duration-300 ease-in-out ${
                    isActiveTrack 
                      ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-lg animate-pulse' 
                      : 'bg-gradient-to-r from-gray-200 to-gray-300 shadow-inner'
                  }`}
                />
              );
            }}
          />
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500 mt-4">
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            <span className="font-medium">{formatTime(min)}</span>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent font-semibold">
            7-day forecast
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium">{formatTime(max)}</span>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineSlider;
