"use client";

import {ReactNode, useEffect} from "react";
import {useKaiaWalletSecurity} from "@/app/hooks/walletSdk.hooks";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export type BootstrapProps = {
    className?: string;
    children?: ReactNode;
}

export const Bootstrap = ({className, children}: BootstrapProps) => {
    const { isSuccess } = useKaiaWalletSecurity();

    useEffect(() => {

        // const preventGoBack = () => {
        //     if(window.location.pathname === '/') {
        //         const isConfirmed = confirm('Are you sure you want to go back?');
        //         if (!isConfirmed) {
        //             history.pushState(null, '', window.location.pathname)
        //         }
        //     }
        // };

        // window.addEventListener('popstate', preventGoBack);

        return () => {
            // window.removeEventListener('popstate', preventGoBack);
        };
    }, []);

    return (
        <>
            <ToastContainer position="top-center" autoClose={1500} hideProgressBar closeOnClick pauseOnHover={false} />
            <div className={className}>{isSuccess && children}</div>
        </>
    )
}

