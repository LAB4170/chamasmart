import { useEffect, useRef } from 'react';

/**
 * Custom hook for async operations in useEffect with automatic cleanup
 * Prevents "Can't perform a React state update on an unmounted component" warnings
 * 
 * @param {Function} asyncFunction - Async function to execute
 * @param {Array} dependencies - Dependency array for useEffect
 * 
 * @example
 * useAsyncEffect(async (isMounted) => {
 *   const data = await fetchData();
 *   if (isMounted()) {
 *     setData(data);
 *   }
 * }, []);
 */
export const useAsyncEffect = (asyncFunction, dependencies = []) => {
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        // Provide isMounted checker to async function
        const isMounted = () => isMountedRef.current;

        // Execute async function
        asyncFunction(isMounted);

        // Cleanup: mark as unmounted
        return () => {
            isMountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
};

/**
 * Custom hook for fetching data with loading and error states
 * Includes automatic cleanup and prevents memory leaks
 * 
 * @param {Function} fetchFunction - Async function that fetches data
 * @param {Array} dependencies - Dependency array
 * @returns {Object} { data, loading, error, refetch }
 * 
 * @example
 * const { data, loading, error, refetch } = useFetch(
 *   async () => await api.getData(),
 *   []
 * );
 */
export const useFetch = (fetchFunction, dependencies = []) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const isMountedRef = useRef(true);

    const executeFetch = async () => {
        try {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            const result = await fetchFunction();

            if (isMountedRef.current) {
                setData(result);
                setLoading(false);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err);
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        executeFetch();

        return () => {
            isMountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    return {
        data,
        loading,
        error,
        refetch: executeFetch,
    };
};

export default useAsyncEffect;
