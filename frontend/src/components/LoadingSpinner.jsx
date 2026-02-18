// Loading component for lazy-loaded routes
const LoadingSpinner = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        flexDirection: 'column',
        gap: '1rem'
    }}>
        <div className="spinner" style={{ width: '50px', height: '50px' }}></div>
        <p style={{ color: '#6b7280' }}>Loading...</p>
    </div>
);

export default LoadingSpinner;
