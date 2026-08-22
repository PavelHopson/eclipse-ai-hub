import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './pages/Chat';
import { Arena } from './pages/Arena';
import { RAG } from './pages/RAG';
import { CodeReview } from './pages/CodeReview';
import { Copywriter } from './pages/Copywriter';
import { SecurityScan } from './pages/SecurityScan';
import { ImageStudio } from './pages/ImageStudio';
import { AdsAudit } from './pages/AdsAudit';
import { ResearchRoom } from './pages/ResearchRoom';
import { ModelRegistry } from './pages/ModelRegistry';
import { GrowthOS } from './pages/GrowthOS';
import { EditorStylist } from './pages/EditorStylist';
import { DeckStudio } from './pages/DeckStudio';
import { AIBuilder } from './pages/AIBuilder';
import { SpecGate } from './pages/SpecGate';
import { AutomationAudit } from './pages/AutomationAudit';
import { Settings } from './pages/Settings';
import { ModuleId } from './types';

type Page = ModuleId | 'settings';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('chat');

  return (
    <div className="flex h-screen overflow-hidden forge-product-shell" data-visual-profile="bento-futurism">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto eclipse-main-grid">
        <div key={page} className="h-full hub-page-enter">
          {page === 'chat' && <Chat />}
          {page === 'arena' && <Arena />}
          {page === 'rag' && <RAG />}
          {page === 'growth-os' && <GrowthOS />}
          {page === 'automation-audit' && <AutomationAudit />}
          {page === 'editor-stylist' && <EditorStylist />}
          {page === 'deck-studio' && <DeckStudio />}
          {page === 'ai-builder' && <AIBuilder />}
          {page === 'spec-gate' && <SpecGate />}
          {page === 'research-room' && <ResearchRoom />}
          {page === 'ads-audit' && <AdsAudit />}
          {page === 'model-registry' && <ModelRegistry />}
          {page === 'code-review' && <CodeReview />}
          {page === 'copywriter' && <Copywriter />}
          {page === 'security-scan' && <SecurityScan />}
          {page === 'image-studio' && <ImageStudio />}
          {page === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
};

export default App;
