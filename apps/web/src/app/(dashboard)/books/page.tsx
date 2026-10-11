import { Header } from "@/components/layout/header";
import { BooksPanel } from "@/components/books/books-panel";

export default function BooksPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Books"
        subtitle="What you're reading, what it's for, and what you took from it"
      />
      <div className="flex-1 p-4 md:p-6">
        <BooksPanel />
      </div>
    </div>
  );
}
