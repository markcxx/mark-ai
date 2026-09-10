import Image from "next/image";

/** Device composition uses real MarkAI screens rather than generated interface text. */
export function DeviceIllustration() {
  return (
    <figure
      aria-label="MarkAI 手机与电脑界面"
      className="relative mx-auto aspect-[1.7] w-full max-w-[580px] select-none"
    >
      <div className="absolute bottom-[9%] right-[2%] w-[84%]">
        <div className="overflow-hidden rounded-t-xl border-[6px] border-gray-800 bg-gray-800 shadow-lg sm:border-[8px]">
          <Image
            src="/images/readme/chat-workbench.png"
            alt="MarkAI 网页版工作空间"
            width={1920}
            height={838}
            priority
            className="aspect-[1.6] w-full object-cover object-left"
          />
        </div>
        <div className="relative -mx-[4%] h-2 rounded-b-xl border-t border-gray-400 bg-gray-300 sm:h-3">
          <div className="mx-auto h-1 w-1/5 rounded-b bg-gray-400" />
        </div>
      </div>
      <div className="absolute bottom-[4%] left-[2%] w-[25%] -rotate-6 overflow-hidden rounded-[20px] border-[4px] border-gray-800 bg-white shadow-xl sm:rounded-[26px] sm:border-[5px]">
        <Image
          src="/images/download/android-chat.png"
          alt="MarkAI Android 对话界面"
          width={1080}
          height={2400}
          priority
          className="h-auto w-full"
        />
      </div>
    </figure>
  );
}
