import { NextPage } from 'next';
import { useRouter } from 'next/router';

const CompleteRegistration: NextPage = () => {
    const router = useRouter();
    const { x_id, x_username } = router.query;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const username = form.username.value;
        const password = form.password.value;

        const response = await fetch('/api/auth/complete-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, x_id, x_username })
        });

        if (response.ok) {
            router.push('/app/(protected)/dashboard');
        } else {
            // Handle error
        }
    };

    return (
        <div>
            <h1>Complete Your Registration</h1>
            <p>Your X account ({x_username}) is not linked to any account. Please create a username and password to finish signing up.</p>
            <form onSubmit={handleSubmit}>
                <label htmlFor="username">Username</label>
                <input type="text" id="username" name="username" required />

                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" required />

                <button type="submit">Complete Registration</button>
            </form>
        </div>
    );
};

export default CompleteRegistration;
