"use client"
import {useState} from 'react'
import '../style.css'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from "firebase/firestore"
import { DB } from '../../firebaseConfig'
import { ClipLoader } from "react-spinners";

const page = () => {
    const [username,setUsername] = useState('')
    const [password,setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading,setLoading] = useState(false)

    const router = useRouter()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
        // Query Firestore for admin credentials
        const q = query(
            collection(DB, "stores"),
            where("username", "==", username),
            where("password", "==", password)
        )

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            const shopId = docSnap.id;

            localStorage.setItem('storeLoggedIn', true)
            localStorage.setItem('storeName', userData?.name)
            localStorage.setItem('storeID', shopId)

            setTimeout(() => {
                router.push("/");
            }, 300);

        } else {
            setError('يرجى التثبت من المعلومات المدرجة')
        }
        } catch (err) {
            setError('يرجى التثبت من المعلومات المدرجة')
        }finally {
            setLoading(false)
        }
    }

    return (
        <div className='login-container'>
            <div className='login-box'>
                <div className='form-title-box'>
                    <h1>Offrelli</h1>
                </div>
                {error && <p style={{color:'red'}}>{error}</p>}
                <div className='login-form-box'>
                    <form className='form'>
                        <input 
                            placeholder='Num Tel' 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <input 
                            placeholder='Mot de Passe' 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {loading ? (
                            <div style={{ width:'250px',height:'35px',backgroundColor:'#1F847A',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <ClipLoader
                                color={'#fff'}
                                loading={loading}
                                size={10}
                                aria-label="Loading Spinner"
                                data-testid="loader"
                                />
                            </div>
                        ) : (
                            <button onClick={handleLogin}>connexion</button>
                        )}
                    </form>
                </div>
            </div>

            {loading && (
                <div className="page-loading-overlay">
                    <ClipLoader size={40} color="#000" />
                    <p>se connecter ...</p>
                </div>
            )}
        </div>
    )
}

export default page