import React from 'react';
import { useCache } from '../contexts/CacheContext';
import { BarChart3, Database, Clock, TrendingUp } from 'lucide-react';

interface CacheStatsProps {
  className?: string;
}

const CacheStats: React.FC<CacheStatsProps> = ({ className = '' }) => {
  const cache = useCache();
  const stats = cache.getCacheStats();

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <Database size={16} className="mr-2 text-blue-500" />
          Cache Performance
        </h3>
        <button
          onClick={() => cache.clear()}
          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
        >
          Clear Cache
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <BarChart3 size={14} className="text-gray-500 dark:text-gray-400 mr-1" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Entries</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalEntries}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock size={14} className="text-gray-500 dark:text-gray-400 mr-1" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Size</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalSize}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={14} className="text-gray-500 dark:text-gray-400 mr-1" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Hit Rate</span>
          </div>
          <div className={`text-lg font-semibold ${
            stats.hitRate >= 80 ? 'text-green-600 dark:text-green-400' :
            stats.hitRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {stats.hitRate}%
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Cache automatically expires data based on type and usage patterns
        </div>
      </div>
    </div>
  );
};

export default CacheStats; 