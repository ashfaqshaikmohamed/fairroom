import {CatalogView} from './components/CatalogView';
import {TutorialProvider} from './components/Tutorial';
import {PublicListingView} from './components/PublicListingView';
import React, { useEffect } from 'react';
import { RouterProvider, useRouter } from './router';
import { AppProvider, useApp } from './context/AppContext';
import { LandingView } from './components/LandingView';
import { SetupView } from './components/SetupView';
import { SurveyView } from './components/SurveyView';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { MatchesWorkspaceView } from './components/MatchesWorkspaceView';
import { GroupWorkspaceView } from './components/GroupWorkspaceView';
import { ScoutWorkspaceView } from './components/ScoutWorkspaceView';

const RouterView: React.FC = () => {
  const { route } = useRouter();
  const { loadGroup, group, error } = useApp();

  // Load group when route has groupId
  useEffect(() => {
    if (
      route.type === 'group_matches' ||
      route.type === 'group_members' ||
      route.type === 'group_scout'
    ) {
      if (!group || group.id !== route.groupId) {
        loadGroup(route.groupId);
      }
    }
  }, [route, loadGroup, group]);

  if (route.type.startsWith('group_') && (!group || group.id !== (route as any).groupId)) return <main className="p-8 max-w-lg mx-auto"><h1 className="text-2xl font-serif mb-4">FairRoom</h1><p role="status">{error || 'Opening your group…'}</p><a className="underline" href="/">Back to home</a></main>;

  switch (route.type) {
    case 'catalog': return <CatalogView/>;
    case 'landing':
      return <LandingView />;

    case 'setup':
      return <SetupView />;

    case 'join':
      return <SurveyView token={route.token} />;

    case 'group_matches':
      return (
        <WorkspaceLayout activeTab="matches" groupId={route.groupId}>
          <MatchesWorkspaceView groupId={route.groupId} />
        </WorkspaceLayout>
      );

    case 'group_members':
      return (
        <WorkspaceLayout activeTab="group" groupId={route.groupId}>
          <GroupWorkspaceView groupId={route.groupId} />
        </WorkspaceLayout>
      );

    case 'group_scout':
      return (
        <WorkspaceLayout activeTab="scout" groupId={route.groupId}>
          <ScoutWorkspaceView groupId={route.groupId} />
        </WorkspaceLayout>
      );

    case 'listing': return <PublicListingView id={route.id}/>;

    default:
      return <LandingView />;
  }
};

export default function App() {
  return (
    <RouterProvider>
      <AppProvider>
        <TutorialProvider><RouterView /></TutorialProvider>
      </AppProvider>
    </RouterProvider>
  );
}
