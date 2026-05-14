import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import AuthBrandPanel from "./AuthBrandPanel";

export default function Signup() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        username: "",
        password: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters long");
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await authClient.signUp.email({
                name: formData.name,
                email: formData.email,
                username: formData.username,
                password: formData.password,
            });
            if (error) {
                setError(error.message || "Failed to create account");
                setIsLoading(false);
                return;
            }
            navigate("/");
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            <AuthBrandPanel />

            <div className="flex-1 flex flex-col p-6 md:p-10">
                <div className="flex items-center justify-between">
                    <Link to="/" className="lg:hidden flex items-center gap-2 font-mono font-bold tracking-tight">
                        <span className="inline-block w-2 h-2 bg-primary" />
                        apptrack
                    </Link>
                    <p className="ml-auto text-sm text-muted-foreground">
                        Already have one?{" "}
                        <Link to="/login" className="text-foreground font-medium hover:text-primary transition-colors inline-flex items-center gap-0.5">
                            Sign in
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </p>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-sm">
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold tracking-tight">
                                Start tracking.
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                It takes thirty seconds and lasts your whole job search.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-5 bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-md border border-destructive/20">
                                {error}
                            </div>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4"
                            autoComplete="on"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label htmlFor="signup-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Name
                                    </label>
                                    <Input
                                        id="signup-name"
                                        name="name"
                                        type="text"
                                        autoComplete="name"
                                        placeholder="Jane Doe"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        disabled={isLoading}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="signup-username" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Username
                                    </label>
                                    <Input
                                        id="signup-username"
                                        name="username"
                                        type="text"
                                        autoComplete="username"
                                        placeholder="janedoe"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                        disabled={isLoading}
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="signup-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Email
                                </label>
                                <Input
                                    id="signup-email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="jane@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="signup-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <Input
                                        id="signup-password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        disabled={isLoading}
                                        className="h-11 pr-11"
                                    />
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() => setShowPassword((s) => !s)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 font-medium mt-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Creating account
                                    </>
                                ) : (
                                    "Create account"
                                )}
                            </Button>
                        </form>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground/60 text-center">
                    Free for students. Always.
                </p>
            </div>
        </div>
    );
}
