import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './pages/Chat';
import { Arena } from './pages/Arena';
import { RAG } from './pages/RAG';
import { CodeReview } from './pages/CodeReview';
import { Copywriter } from './pages/Copywriter';
import { SecurityScan } from './pages/SecurityScan';
import { ImageStudio } from './pages/ImageStudio';
import { Settings } from './pages/Settings';
import { ModuleId } from './types';

type Page = ModuleId | 'settings';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('chat');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto">
        {page === 'chat' && <Chat />}
        {page === 'arena' && <Arena />}
        {page === 'rag' && <RAG />}
        {page === 'code-review' && <CodeReview />}
        {page === 'copywriter' && <Copywriter />}
        {page === 'security-scan' && <SecurityScan />}
        {page === 'image-studio' && <ImageStudio />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  );
};

export default App;
