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
      whileHover={{ y: -8, scale: 1.02 }}
      className="glass-panel rounded-2xl overflow-hidden flex flex-col h-full transition-all group"
    >
      <Link to={`/book/${book.id}`} className="block flex-grow">
        <div className="aspect-[3/4] relative overflow-hidden bg-white/5">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <BookOpen size={48} />
            </div>
          )}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-dark/80 backdrop-blur-md border border-white/10">
            <div className={`h-2 w-2 rounded-full shadow-[0_0_8px] ${
              book.availableCopies === 0 ? 'bg-rose-500 shadow-rose-500 animate-pulse' : 
              book.availableCopies <= 2 ? 'bg-amber-500 shadow-amber-500' : 'bg-primary-accent shadow-primary-accent'
            }`} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              {book.availableCopies === 0 ? 'OUT OF CORE' : 
               book.availableCopies <= 2 ? 'LOW AVAILABILITY' : 'AVAILABLE'}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col flex-grow">
          <div className="mb-4">
            <h3 className="text-lg font-black text-white line-clamp-2 leading-tight mb-2 group-hover:text-primary-accent transition-colors tracking-tight">
              {book.title}
            </h3>
            <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-widest px-2 py-1 bg-white/5 rounded-lg w-fit">
              <User size={12} className="mr-1.5 text-secondary-accent" />
              <span className="truncate">{book.author}</span>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex items-center text-[10px] text-slate-500 font-bold tracking-widest uppercase">
              <Tag size={10} className="mr-1.5 text-primary-accent" />
              <span>{book.genre}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-6 pt-0">
        <button
          onClick={(e) => {
            e.preventDefault();
            onReserve?.(book.id);
          }}
          className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.95] ${
            isAvailable
              ? 'bg-primary-accent text-white hover:bg-primary-accent/90 shadow-primary-accent/20'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
          }`}
        >
          {isAvailable ? 'Borrow' : 'Request Access'}
        </button>
      </div>
    </motion.div>
  );
}
