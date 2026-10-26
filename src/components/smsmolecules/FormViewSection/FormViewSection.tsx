import React from 'react';
import './FormViewSection.css';

export interface FormViewSectionProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export const FormViewSection: React.FC<FormViewSectionProps> = ({
    title,
    children,
    className = '',
}) => {
    return (
        <div className={`form-view-section ${className}`}>
            {title && <div className="form-view-section__title">{title}</div>}
            <div className="form-view-section__content">
                {children}
            </div>
        </div>
    );
};
