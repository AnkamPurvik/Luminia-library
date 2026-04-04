import { Book } from '../../types';
import { motion } from 'motion/react';
import { BookOpen, User, Hash, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BookCardProps {
  book: Book;
  onReserve?: (bookId: string) => void;
}

export function BookCard({ book, onReserve }: BookCardProps) {
  const isAvailable = book.availableCopies > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md"
    >
      <Link to={`/book/${book.id}`} className="block flex-grow">
        <div className="aspect-[3/4] relative overflow-hidden bg-slate-100">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <BookOpen size={48} />
            </div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-slate-100">
            <div className={`h-2 w-2 rounded-full ${
              book.availableCopies === 0 ? 'bg-rose-500 animate-pulse' : 
              book.availableCopies <= 2 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              {book.availableCopies === 0 ? 'Out of Stock' : 
               book.availableCopies <= 2 ? 'Low Stock' : 'Available'}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900 line-clamp-2 leading-tight mb-1 group-hover:text-indigo-600 transition-colors">
              {book.title}
            </h3>
            <div className="flex items-center text-slate-600 text-sm">
              <User size={14} className="mr-1" />
              <span className="truncate">{book.author}</span>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-xs text-slate-500">
              <Hash size={12} className="mr-1" />
              <span>ISBN: {book.isbn}</span>
            </div>
            <div className="flex items-center text-xs text-slate-500">
              <Tag size={12} className="mr-1" />
              <span>{book.genre}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-5 pt-0">
        <button
          onClick={(e) => {
            e.preventDefault();
            onReserve?.(book.id);
          }}
          className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-[0.98] ${
            isAvailable
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100'
          }`}
        >
          {isAvailable ? 'Borrow Now' : 'Reserve Item'}
        </button>
      </div>
    </motion.div>
  );
}
