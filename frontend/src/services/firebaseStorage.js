// c:\Users\Eobord\Desktop\chamasmart\frontend\src\services\firebaseStorage.js
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import app from "../config/firebase";
import api from "./axios";

const storage = getStorage(app);

export const uploadMediaToFirebase = async (file, pathPrefix = 'chat_media') => {
  if (!file) return null;

  // Use Backend Proxy for avatars to bypass CORS issues
  if (pathPrefix === 'avatars') {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post('/users/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        return response.data.data.profilePictureUrl;
      }
    } catch (error) {
      console.error("Backend upload proxy failed, falling back to direct Firebase:", error);
      // Fallback to direct Firebase SDK if backend fails
    }
  }

  return new Promise((resolve, reject) => {
    // Generate unique filename
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name}`;
    const storageRef = ref(storage, `${pathPrefix}/${uniqueFileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // We could implement upload progress tracking here if desired
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => {
        console.error("Firebase upload error:", error);
        reject(error);
      },
      () => {
        // Upload completed successfully, now we can get the download URL
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          resolve(downloadURL);
        });
      }
    );
  });
};
