import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import AuthBrandPanel from "./AuthBrandPanel";

export default function Login() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        usernameOrEmail: "",
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

        try {
            const isEmail = formData.usernameOrEmail.includes("@");
            if (isEmail) {
                const { error } = await authClient.signIn.email({
                    email: formData.usernameOrEmail,
                    password: formData.password,
                });
                if (error) {
                    setError(error.message || "Invalid email or password");
                    setIsLoading(false);
                    return;
                }
            } else {
                const { error } = await authClient.signIn.username({
                    username: formData.usernameOrEmail,
                    password: formData.password,
                });
                if (error) {
                    setError(error.message || "Invalid username or password");
                    setIsLoading(false);
                    return;
                }
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

            {/* Right: form */}
            <div className="flex-1 flex flex-col p-6 md:p-10">
                <div className="flex items-center justify-between">
                    <Link to="/" className="lg:hidden flex items-center gap-2 font-mono font-bold tracking-tight">
                        <span className="inline-block w-2 h-2 bg-primary" />
                        apptrack
                    </Link>
                    <p className="ml-auto text-sm text-muted-foreground">
                        New here?{" "}
                        <Link to="/signup" className="text-foreground font-medium hover:text-primary transition-colors inline-flex items-center gap-0.5">
                            Create an account
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </p>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-sm">
                        <div className="mb-10">
                            <h1 className="text-4xl font-bold tracking-tight">
                                Welcome back.
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Pick up where you left off.
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
                            <div className="space-y-1.5">
                                <label htmlFor="login-id" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Email or username
                                </label>
                                <Input
                                    id="login-id"
                                    name="usernameOrEmail"
                                    type="text"
                                    autoComplete="username"
                                    placeholder="you@example.com"
                                    value={formData.usernameOrEmail}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="login-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <Input
                                        id="login-password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
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
                                        Signing in
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground/60 text-center">
                    Made for students chasing their first big shot.
                </p>
            </div>
        </div>
    );
}
