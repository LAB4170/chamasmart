import React from 'react';

const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
    const skeletons = Array.from({ length: count });

    const renderSkeleton = (index) => {
        switch (type) {
            case 'card':
                return (
                    <div key={index} className="skeleton-card">
                        <div className="skeleton-image"></div>
                        <div className="skeleton-content">
                            <div className="skeleton-title"></div>
                            <div className="skeleton-text"></div>
                            <div className="skeleton-text"></div>
                        </div>
                    </div>
                );
            case 'row':
                return (
                    <div key={index} className="skeleton-row">
                        <div className="skeleton-cell"></div>
                        <div className="skeleton-cell"></div>
                        <div className="skeleton-cell"></div>
                    </div>
                );
            case 'detail':
                return (
                    <div key={index} className="skeleton-detail">
                        <div className="skeleton-header"></div>
                        <div className="skeleton-body">
                            <div className="skeleton-block"></div>
                            <div className="skeleton-block"></div>
                            <div className="skeleton-block"></div>
                        </div>
                    </div>
                );
            default:
                return <div key={index} className="skeleton-base"></div>;
        }
    };

    return (
        <div className={`skeleton-container skeleton-${type}`}>
            {skeletons.map((_, index) => renderSkeleton(index))}
        </div>
    );
};

export default LoadingSkeleton;
