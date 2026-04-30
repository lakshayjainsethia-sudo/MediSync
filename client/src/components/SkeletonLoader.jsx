/**
 * Elegant Skeleton Loader matching the structure of typical cards and tables.
 * Uses Tailwind's animate-pulse to provide a classy loading state.
 */
const SkeletonLoader = ({ type = 'card' }) => {
  if (type === 'card') {
    return (
      <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-slate-100 p-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-100 p-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-full mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex space-x-4 mb-3">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-2/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export default SkeletonLoader;
