
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inviteAPI } from '../../../services/api';


const JoinChama = () => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!inviteCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setLoading(true);

        try {
            const response = await inviteAPI.join(inviteCode.trim().toUpperCase());
            const chamaId = response.data.data.chama.chama_id;

            // Redirect to the chama page
            navigate(`/ chamas / ${chamaId} `);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join chama. Please check the invite code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div className="join-chama-container">
                    <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
                        <div className="text-center mb-3">
                            <h1>Join a Chama</h1>
                            <p className="text-muted">Enter the invite code you received</p>
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Invite Code</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., A3F2B9C1"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength="20"
                                    style={{
                                        fontSize: '1.5rem',
                                        textAlign: 'center',
                                        letterSpacing: '0.1em',
                                        fontWeight: 'bold'
                                    }}
                                    required
                                />
                                <small className="text-muted">
                                    Enter the 8-character code exactly as shown
                                </small>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-block"
                                disabled={loading}
                            >
                                {loading ? 'Joining...' : 'Join Chama'}
                            </button>
                        </form>

                        <div className="mt-3 text-center">
                            <button
                                className="btn btn-outline"
                                onClick={() => navigate('/dashboard')}
                            >
                                ← Back to Dashboard
                            </button>
                        </div>
                    </div>

                    <div className="card mt-3" style={{ maxWidth: '500px', margin: '0 auto' }}>
                        <h3>How to Join</h3>
                        <ol style={{ paddingLeft: '1.5rem' }}>
                            <li className="mb-2">Get an invite code from a chama official</li>
                            <li className="mb-2">Enter the code in the field above</li>
                            <li className="mb-2">Click "Join Chama"</li>
                            <li>You'll be added as a member automatically!</li>
                        </ol>

                        <div className="alert alert-info mt-3">
                            <strong>Note:</strong> You must be logged in to join a chama. Each invite code can typically only be used once.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinChama;
