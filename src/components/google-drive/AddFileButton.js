import React, { useState } from 'react'
import ReactDOM from "react-dom"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileUpload } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../../contexts/AuthContext'
import { storage, database } from '../../firebase'
import { doc, setDoc } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { ROOT_FOLDER } from '../../hooks/useFolder'
import { v4 as uuidV4 } from "uuid"
import { ProgressBar, Toast } from "react-bootstrap"

export default function AddFileButton({ currentFolder }) {
    const [uploadingFiles, setUploadingFiles] = useState([])
    const { currentUser } = useAuth()

    function handleUpload(e) {
        e.preventDefault()
        const file = e.target.files[0]
        if (currentFolder == null || file == null) return

        const id = uuidV4()
        setUploadingFiles(prevUploadingFiles => [
            ...prevUploadingFiles,
            { id: id, name: file.name, progress: 0, error: false },
        ])

        const filePath =
            currentFolder === ROOT_FOLDER
                ? `${currentFolder.path.join("/")}/${file.name}`
                : `${currentFolder.path.join("/")}/${currentFolder.name}/${file.name}`

        const uploadTask = uploadBytesResumable(ref(storage, `/files/${currentUser.uid}/${filePath}`), file)

        uploadTask.on(
            'state-changed',
            (snapshot) => {
                const progress = snapshot.bytesTransferred / snapshot.totalBytes
                setUploadingFiles(prevUploadingFiles => {
                    return prevUploadingFiles.map(uploadFile => {
                        if (uploadFile.id === id) {
                            return { ...uploadFile, progress: progress }
                        }

                        return uploadFile
                    })
                })
            },
            (error) => {
                setUploadingFiles(prevUploadingFiles => {
                    return prevUploadingFiles.map(uploadFile => {
                        if (uploadFile.id === id) {
                            return { ...uploadFile, error: true }
                        }
                        return uploadFile
                    })
                })
            },
            () => {
                setUploadingFiles(prevUploadingFiles => {
                    return prevUploadingFiles.filter(uploadFile => {
                        return uploadFile.id !== id
                    })
                })

                getDownloadURL(uploadTask.snapshot.ref).then(url => {
                    setDoc(doc(database.files), {
                        url: url,
                        name: file.name,
                        createdAt: database.getCurrentTimestamp,
                        folderID: currentFolder.id,
                        userID: currentUser.uid
                    })
                })
            }
        )
    }

    return <label className='btn btn-outline-success btn-sm m-0 mr-2'>
        <>
            <FontAwesomeIcon icon={faFileUpload} />
            <input
                type="file"
                onChange={handleUpload}
                style={{ opacity: 0, position: "absolute", left: "-9999px" }}
            />
            {uploadingFiles.length > 0 &&
                ReactDOM.createPortal(
                    <div
                        style={{
                            position: "absolute",
                            bottom: "1rem",
                            right: "1rem",
                            maxWidth: "250px",
                        }}
                    >
                        {uploadingFiles.map(file => (
                            <Toast
                                key={file.id}
                                onClose={() => {
                                    setUploadingFiles(prevUploadingFiles => {
                                        return prevUploadingFiles.filter(uploadFile => {
                                            return uploadFile.id !== file.id
                                        })
                                    })
                                }}
                            >
                                <Toast.Header
                                    closeButton={file.error}
                                    className="text-truncate w-100 d-block"
                                >
                                    {file.name}
                                </Toast.Header>
                                <Toast.Body>
                                    <ProgressBar
                                        animated={!file.error}
                                        variant={file.error ? "danger" : "primary"}
                                        now={file.error ? 100 : file.progress * 100}
                                        label={
                                            file.error
                                                ? "Error"
                                                : `${Math.round(file.progress * 100)}%`
                                        }
                                    />
                                </Toast.Body>
                            </Toast>
                        ))}
                    </div>,
                    document.body
                )}
        </>

    </label>
}
