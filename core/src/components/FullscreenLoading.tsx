import Lottie from "lottie-react";
import loadingAnimation from "../assets/loading-blue.json";

const FullscreenLoading = () => {
  return (
    <div className="w-32 h-32 flex justify-center items-center">
      <Lottie animationData={loadingAnimation} loop autoplay />
    </div>
  );
};

export default FullscreenLoading;
