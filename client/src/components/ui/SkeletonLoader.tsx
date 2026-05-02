
interface SkeletonLoaderProps {
  className?: string;
  type?: 'card' | 'text' | 'round';
}

export default function SkeletonLoader({ className = '', type = 'text' }: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-slate-200 rounded';
  
  let typeClasses = '';
  switch (type) {
    case 'card':
      typeClasses = 'h-32 w-full rounded-xl';
      break;
    case 'round':
      typeClasses = 'h-12 w-12 rounded-full';
      break;
    case 'text':
    default:
      typeClasses = 'h-4 w-3/4';
      break;
  }

  return (
    <div className={`${baseClasses} ${typeClasses} ${className}`}></div>
  );
}
