import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from '../icons.jsx';

export function PageHeader({ title, subtitle, action, back, backLabel = 'Back', className }) {
  return (
    <div className={clsx('mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        {back ? (
          <Link to={back} className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
            <Icon name="arrowLeft" className="h-4 w-4" /> {backLabel}
          </Link>
        ) : null}
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{action}</div> : null}
    </div>
  );
}

export default PageHeader;
