import React from 'react';
import { Card, PageHeader, PlaceholderContent } from '../components/ui';

export const ResourcesPage: React.FC = () => (
  <div className="space-y-8">
    <PageHeader title="Resources" subtitle="Learning library and knowledge base." />
    
    <section>
      <h2 className="text-xl font-semibold mb-4 text-slate-900">Strategic Frameworks</h2>
      <Card className="p-6">
         <PlaceholderContent text="Empty list container" />
      </Card>
    </section>

    <section>
      <h2 className="text-xl font-semibold mb-4 text-slate-900">Templates & Tools</h2>
      <Card className="p-6">
         <PlaceholderContent text="Empty list container" />
      </Card>
    </section>

    <section>
      <h2 className="text-xl font-semibold mb-4 text-slate-900">Learning Resources</h2>
      <Card className="p-6">
         <PlaceholderContent text="Empty list container" />
      </Card>
    </section>

    <section>
      <h2 className="text-xl font-semibold mb-4 text-slate-900">Stage-Specific Guidance</h2>
      <Card className="p-6">
         <PlaceholderContent text="Empty list container" />
      </Card>
    </section>
  </div>
);