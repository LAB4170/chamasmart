import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, TrendingUp, Users, RefreshCw, Landmark, HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const images = [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80'
];

const LandingPage = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    // Slideshow interval
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, 5000); // Change image every 5 seconds
        return () => clearInterval(interval);
    }, []);

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
    };

    const features = [
        {
            icon: <RefreshCw size={28} />,
            title: "ROSCA Auto-Rotation",
            desc: "Merry-go-round made easy. Automate payouts, track member contributions, and maintain total transparency.",
            image: "/images/feature_rosca.png"
        },
        {
            icon: <TrendingUp size={28} />,
            title: "ASCA Investment Pools",
            desc: "Accumulate wealth. Manage shares, propose investments, and track dividends with enterprise-grade precision.",
            image: "/images/feature_asca.png"
        },
        {
            icon: <Landmark size={28} />,
            title: "Table Banking",
            desc: "Real-time loan disbursement. Bring money to the table and manage interest and loans efficiently during meetings.",
            image: "/images/feature_table_banking.png"
        },
        {
            icon: <HeartHandshake size={28} />,
            title: "Welfare Funds",
            desc: "Secure benevolent funds for emergencies. Configurable event categories and robust claims verification.",
            image: "/images/slide2.png"
        },
        {
            icon: <Shield size={28} />,
            title: "AI Expert System",
            desc: "Automated loan adjudication utilizing MYCIN-style certainty factors to analyze risk, guarantors, and liquidity.",
            image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80"
        },
        {
            icon: <Users size={28} />,
            title: "Member Governance",
            desc: "Role-based access control. Assign Chairpersons, Treasurers, and securely manage all invitations.",
            image: "/images/slide1.png"
        }
    ];

    if (isAuthenticated) return null; // Avoid flashing the page before redirect

    return (
        <div className="landing-container">
            {/* Hero Section with Slideshow */}
            <div className="landing-lux-wrapper">
                <section className="landing-lux-section">
                    
                    {/* Left: Content */}
                    <div className="landing-lux-content">
                        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lux-badge">
                            <Zap size={14} />
                            <span>The Premier Finance Platform</span>
                        </motion.div>
                        
                        <motion.h1 variants={itemVariants} initial="hidden" animate="visible" className="landing-lux-title">
                            Elevate Your Savings <br />
                            <span className="text-gold-gradient">Master Your Wealth</span>
                        </motion.h1>
                        
                        <motion.p variants={itemVariants} initial="hidden" animate="visible" className="landing-lux-subtitle">
                            ChamaSmart delivers an unparalleled suite of tools for African savings groups. 
                            From Table Banking to complex ASCA dividend distributions, experience financial governance redefined.
                        </motion.p>
                        
                        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="landing-lux-actions">
                            <a href="/register" className="btn-lux-primary">
                                <span>Initialize Portfolio</span>
                                <ArrowRight size={20} />
                            </a>
                            <a href="/login" className="btn-lux-secondary">
                                Access Portal
                            </a>
                        </motion.div>
                    </div>

                    {/* Right: Floating Slideshow */}
                    <div className="landing-lux-visuals">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentImageIndex}
                                className="slide-image-container"
                                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                            >
                                <img src={images[currentImageIndex]} alt={`Slide ${currentImageIndex}`} className="slide-image" />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                </section>
            </div>

            {/* Features Grid */}
            <section className="lux-features-section">
                <div className="section-header-center">
                    <motion.span 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="section-subtitle"
                    >
                        Exclusive Capabilities
                    </motion.span>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="section-title"
                    >
                        Engineered for Prosperity
                    </motion.h2>
                </div>

                <motion.div 
                    className="lux-features-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                >
                    {features.map((feature, index) => (
                        <motion.div key={index} variants={itemVariants} className="lux-feature-card">
                            <div className="lux-feature-image">
                                <img src={feature.image} alt={feature.title} />
                            </div>
                            <div className="lux-feature-content">
                                <div className="lux-icon-wrapper">
                                    {feature.icon}
                                </div>
                                <h3>{feature.title}</h3>
                                <p>{feature.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* CTA Section */}
            <section className="lux-cta-section">
                <motion.div 
                    className="lux-cta-box"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2>The Future of Group Economics</h2>
                    <p>Join the elite tier of savings groups utilizing ChamaSmart to secure, grow, and manage their collective wealth.</p>
                    <a href="/register" className="btn-lux-primary">
                        <span>Begin Your Legacy</span>
                        <ArrowRight size={20} />
                    </a>
                </motion.div>
            </section>
        </div>
    );
};

export default LandingPage;
