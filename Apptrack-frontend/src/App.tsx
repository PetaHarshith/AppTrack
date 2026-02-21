import { Refine } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
    DocumentTitleHandler,
    UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import "./App.css";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { dataProvider } from "./providers/data";
import Dashboard from "@/pages/dashboard.tsx";
import { ClipboardList, Home } from "lucide-react";
import { Layout } from "@/components/refine-ui/layout/layout.tsx";
import ApplicationsList from "@/pages/applications/ApplicationsList.tsx";
import ApplicationsCreate from "@/pages/applications/ApplicationsCreate.tsx";

function App() {
    return (
        <BrowserRouter>
            <RefineKbarProvider>
                <ThemeProvider>
                    <DevtoolsProvider>
                        <Refine
                            dataProvider={dataProvider}
                            notificationProvider={useNotificationProvider()}
                            routerProvider={routerProvider}
                            options={{
                                syncWithLocation: true,
                                warnWhenUnsavedChanges: true,
                                projectId: "rU5QXW-YissXg-5PtwMk",
                            }}

                            resources={[
                                {
                                    name: 'dashboard',
                                    list: '/',
                                    meta: { label: 'Home', icon: <Home /> }
                                },
                                {
                                    name: 'applications',
                                    list: '/applications',
                                    create: '/applications/create',
                                    meta: { label: 'Applications', icon: <ClipboardList /> }
                                }
                            ]}
                        >
                            <Routes>

                                <Route element={
                                    <Layout>
                                        <Outlet />
                                    </Layout>
                                }>

                                    <Route path="/" element={<Dashboard />} />

                                    <Route path="/applications">
                                        <Route index element={<ApplicationsList />} />
                                        <Route path="create" element={<ApplicationsCreate />} />
                                    </Route>

                                </Route>

                            </Routes>
                            <Toaster />
                            <RefineKbar />
                            <UnsavedChangesNotifier />
                            <DocumentTitleHandler />
                        </Refine>
                    </DevtoolsProvider>
                </ThemeProvider>
            </RefineKbarProvider>
        </BrowserRouter>
    );
}

export default App;
