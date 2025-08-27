import React from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-[400px] bg-white rounded-xl p-6 pt-8 shadow-lg"
        onClick={e => e.stopPropagation()} // 모달 내부 클릭 시 닫힘 방지
      >
        <button
          className="absolute top-2 right-3 text-2xl text-gray-700 hover:text-black focus:outline-none"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
