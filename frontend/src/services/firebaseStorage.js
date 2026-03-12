// c:\Users\Eobord\Desktop\chamasmart\frontend\src\services\firebaseStorage.js
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import app from "../config/firebase";

const storage = getStorage(app);

export const uploadMediaToFirebase = async (file, pathPrefix = 'chat_media') => {
  if (!file) return null;

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
