"use client";
import { useState,useRef,useEffect } from "react";
import {useRouter} from 'next/navigation'
import {collection,query,where,getDoc,getDocs,updateDoc,doc,addDoc,serverTimestamp,orderBy,limit,startAfter} from "firebase/firestore";
import { DB } from "../firebaseConfig";
import { ClipLoader } from "react-spinners";
import { ImCross } from "react-icons/im";
import { FaCheck } from "react-icons/fa";
import { FaExclamationTriangle } from "react-icons/fa";
import { MdOutlineTimerOff } from "react-icons/md";
import dayjs from "dayjs";
import "dayjs/locale/ar";
import "./style.css";

export default function StoreDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storeName,setStoreName] = useState('');
  const [storeID,setStoreID] = useState('');
  const [cardsLimit, setCardsLimit] = useState(0);
  const [codesGenerated, setCodesGenerated] = useState(0);
  const [activeTab, setActiveTab] = useState("search");
  const [discountAmount, setDiscountAmount] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [markingAsUsedLoading,setMarkingAsUsedLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [filterPhone, setFilterPhone] = useState("");
  const [filterRemise, setFilterRemise] = useState("");
  const [filterUsed, setFilterUsed] = useState("all");
  const [loggingOut, setLoggingOut] = useState(false);

  dayjs.locale("ar");
  const router = useRouter();

  // Check if admin is logged in
  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('storeLoggedIn')

    if (!adminLoggedIn) {
      router.push('/login')
      return
    }

    const id = localStorage.getItem('storeID');
    setStoreID(localStorage.getItem('storeID'));
    setStoreName(localStorage.getItem('storeName'));

    const fetchStoreData = async () => {
      try {
        const storeSnap = await getDoc(doc(DB, "stores", id));

        if (storeSnap.exists()) {
          const data = storeSnap.data();
          setCardsLimit(data.cards_limit || 0);
          setCodesGenerated(data.codes_generated || 0);
        }

      } catch (err) {
        console.error(err);
      }
    };

    fetchStoreData();
    setIsAuthenticated(true);
  }, [])

  //Logout
  const handleLogout = () => {
    setLoggingOut(true);

    // let UI update first
    setTimeout(() => {
      localStorage.removeItem('storeLoggedIn')
      localStorage.removeItem('storeName')
      localStorage.removeItem('storeID')

      router.push("/login");
    }, 300);
  }

  //Verify client discount
  const handleVerify = async () => {
    if (!verifyPhone) {
      alert("Veuillez entrer le numéro de téléphone");
      return;
    }

    try {
      setLoadingVerify(true);

      const q = query(
        collection(DB, "discounts"),
        where("store_id", "==", storeID),
        where("scanned", "==", true),
        where("phone_number", "==", verifyPhone),
        where("archived", "==", false),
        orderBy("scanned_at", "desc"),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setVerifyResult({ status: "not_found" });
        return;
      }

      const discountDoc = snapshot.docs[0];
      const discountData = discountDoc.data();

      const now = new Date();
      const expiredAt = discountData.expired_at?.toDate();

      if (discountData.used) {
        setVerifyResult({
          status: "used",
          used_at: discountData.used_at?.toDate()
        });
        return;
      }

      if (expiredAt && expiredAt < now) {
        await updateDoc(doc(DB, "discounts", discountDoc.id), {
          archived: true
        });

        setVerifyResult({
          status: "expired",
          expired_at: expiredAt
        });
        return;
      }

      setVerifyResult({
        status: "valid",
        id: discountDoc.id,
        amount: discountData.discount_amount,
        phone: discountData.phone_number
      });

    } catch (error) {
      console.error(error);
      alert("Une erreur s'est produite. Veuillez réessayer plus tard");
    } finally {
      setLoadingVerify(false);
    }
  };

  //Mark discount as used
  const handleMarkUsed = async () => {
    try {
      setMarkingAsUsedLoading(true)

      await updateDoc(doc(DB, "discounts", verifyResult.id), {
        used: true,
        used_at: new Date()
      });

      setVerifyResult(null);
      setVerifyPhone("");

    } catch (error) {
      console.error(error);
      alert("Une erreur s'est produite. Veuillez réessayer plus tard");
    } finally {
      setMarkingAsUsedLoading(false)
    }
  };

  //Generate discount code
  const handleGenerate = async () => {
    if (codesGenerated >= cardsLimit) {
      alert("وصلت للحد الأقصى متاع الكودات يلزمك تطلب كوارت جدد باش تكمل الخدمة");
      return;
    }

    if (!discountAmount) {
      alert("Veuillez saisir le pourcentage de remise")
      return;
    }

    try {
      setLoadingGenerate(true);

      let unique = false;
      let generatedCode = "";

      while (!unique) {
        generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

        const q = query(
          collection(DB, "discounts"),
          where("store_id", "==", storeID),
          where("discount_code", "==", generatedCode)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          unique = true;
        }
      }

      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 1);

      await addDoc(collection(DB, "discounts"), {
        store_id: storeID,
        store_name:storeName,
        discount_amount: Number(discountAmount),
        discount_code: generatedCode,
        phone_number: null,
        scanned:false,
        scanned_at: null,
        used: false,
        used_at:null,
        created_at: serverTimestamp(),
        expired_at:expiry,
        archived:false
      });

      await updateDoc(doc(DB, "stores", storeID), {
        codes_generated: codesGenerated + 1
      });

      setCodesGenerated(prev => prev + 1);

      setGeneratedCode({
        code: generatedCode,
        amount: discountAmount
      });

    } catch (error) {
      console.error(error);
      alert("Erreur lors de la génération");
    } finally {
      setLoadingGenerate(false);
    }
  };

  //Fetch Client discounts
  const fetchClients = async (loadMore = false) => {
    try {
      setLoadingClients(true);

      let constraints = [
        where("store_id", "==", storeID),
        where("scanned", "==", true),
        orderBy("scanned_at", "desc")
      ];

      // Phone filter
      if (filterPhone) {
        constraints.push(where("phone_number", "==", filterPhone));
      }

      // Remise filter
      if (filterRemise) {
        constraints.push(where("discount_amount", "==", Number(filterRemise)));
      }

      // Used filter
      if (filterUsed === "used") {
        constraints.push(where("used", "==", true));
      }

      if (filterUsed === "not_used") {
        constraints.push(where("used", "==", false));
      }

      if (loadMore && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      constraints.push(limit(20));

      const q = query(collection(DB, "discounts"), ...constraints);

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHasMore(false);

        if (!loadMore) {
          setClients([]);
        }

        return;
      }

      if (snapshot.docs.length < 20) {
        setHasMore(false);
      }

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));


      setClients(prev =>
        loadMore ? [...prev, ...data] : data
      );

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

    } catch (error) {
      console.error(error);
      alert("Une erreur s'est produite. Veuillez réessayer plus tard");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (activeTab === "clients" && storeID) {
      fetchClients();
    }
  }, [activeTab, storeID]);

  const applyFilters = () => {
    setLastDoc(null);
    setHasMore(true);
    fetchClients(false);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ width:'100vw',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <ClipLoader
        color={'#000'}
        loading={!isAuthenticated}
        size={70}
        aria-label="Loading Spinner"
        data-testid="loader"
      />
      </div>   
  )}

  return (
    <div className="store-dashboard" dir="rtl">

      <header className="store-header">
        <div className="header-left">
          <h1>Offrelli</h1>
        </div>

        <div className="header-right">
          <span className="store-name">
            {storeName}
          </span>

          <span className="store-name">
            ({cardsLimit} / {codesGenerated})
          </span>

          <button className="logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      {loggingOut && (
        <div className="page-loading-overlay">
          <ClipLoader size={40} color="#000" />
          <p>se déconnecter ...</p>
        </div>
      )}

      <main className="store-container">
        <div className="tabs">
          <button
            className={activeTab === "search" ? "tab active" : "tab"}
            onClick={() => setActiveTab("search")}
          >
            verifier remise
          </button>

          <button
            className={activeTab === "generate" ? "tab active" : "tab"}
            onClick={() => setActiveTab("generate")}
          >
            générer un code
          </button>

          <button
            className={activeTab === "clients" ? "tab active" : "tab"}
            onClick={() => setActiveTab("clients")}
          >
            mes clients
          </button>
        </div>

        {activeTab === "generate" && (
          <section className="card">
            {!generatedCode ? (
              <div className="generate-row">
                <input
                  placeholder="remise (%)"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  dir="ltr"
                />
                <button
                  className="primary-btn"
                  onClick={handleGenerate}
                  disabled={loadingGenerate}
                >
                  {loadingGenerate ? "..." : "Générer"}
                </button>
              </div>
            ) : (
              <div className="generated-result">
                <h2>Remise {generatedCode.amount}%</h2>

                <div className="big-code">
                  {generatedCode.code}
                </div>

                <button
                  className="primary-btn"
                  onClick={() => {
                    setGeneratedCode(null);
                    setDiscountAmount("");
                  }}
               >
                  Générer nouveau code
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === "search" && (
          <section className="card">
            {!verifyResult ? (
              <div className="generate-row">
                <input
                  placeholder="Numéro de téléphone"
                  value={verifyPhone}
                  onChange={(e) => setVerifyPhone(e.target.value)}
                  dir="ltr"
                />
                <button
                  className="primary-btn"
                  onClick={handleVerify}
                  disabled={loadingVerify}
                >
                  {loadingVerify ? "..." : "Vérifier"}
                </button>
              </div>
            ) : (
              <div className="verification-result">
                {verifyResult.status === "valid" && (
                  <div>
                    <FaCheck size={30} color="#2ecc71"/>
                    <h3>Remise valide</h3>
                    <p className="amount">{verifyResult.amount}%</p>
                    <p className="amount">{verifyResult.phone}</p>
                    <button 
                      className="primary-btn" 
                      onClick={handleMarkUsed}
                      disabled={markingAsUsedLoading}
                    >
                      {markingAsUsedLoading ? "..." : "Marquer comme utilisée"}                    
                    </button>
                  </div>
                )}

                {verifyResult.status === "not_found" && (
                  <div>
                    <ImCross size={30} color="#e74c3c"/>
                    <h3>Aucune remise trouvée</h3>
                  </div>
                )}

                {verifyResult.status === "used" && (
                  <div>
                    <FaExclamationTriangle size={30} color="#f39c12"/>
                    <h3>Remise déjà utilisée</h3>
                    <p>Utilisée le : {dayjs(verifyResult.used_at).format("DD/MM/YYYY")}</p>
                  </div>
                )}

                {verifyResult.status === "expired" && (
                  <div>
                    <MdOutlineTimerOff size={30} color="#f39c12"/>
                    <h3>Remise expirée</h3>
                    <p>Expirée le : {dayjs(verifyResult.expired_at).format("DD/MM/YYYY")}</p>
                  </div>
                )}

                {verifyResult.status !== "valid" && (
                  <button
                    className="primary-btn"
                    style={{marginTop:'10px'}}
                    onClick={() => {
                      setVerifyResult(null);
                      setVerifyPhone("");
                    }}
                  >
                    Vérifier nouveau code
                  </button>
                )}
                
              </div>
            )}
          </section>
        )}

        {activeTab === "clients" && (
          <section className="card">
            <div className="filters-grid">
              <input
                placeholder="Téléphone"
                value={filterPhone}
                onChange={(e) => setFilterPhone(e.target.value)}
                dir="ltr"
              />
              <input
                placeholder="Remise %"
                value={filterRemise}
                onChange={(e) => setFilterRemise(e.target.value)}
                dir="ltr"
              />
              <select
                value={filterUsed}
                onChange={(e) => setFilterUsed(e.target.value)}
              >
                <option value="all">Tous</option>
                <option value="used">Utilisé</option>
                <option value="not_used">Non utilisé</option>
              </select>

              <button
                className="filter-btn"
                onClick={applyFilters}
              >
                Filtrer
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tel</th>
                    <th>Remise</th>
                    <th>Utilisé</th>
                    <th>Scan</th>
                    <th>Expiration</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingClients ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        <ClipLoader size={25} />
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        Aucun client trouvé
                      </td>
                    </tr>
                  ) : (
                    clients.map(client => (
                        <tr key={client.id}>
                          <td dir="ltr">{client.phone_number || "-"}</td>
                          <td>{client.discount_amount}%</td>
                          <td>
                            {client.used ? (
                              <span className="discount_status used_discount">Oui</span>
                            ) : (
                              <span className="discount_status not_used_discount">Non</span>
                            )}
                          </td>
                          <td>
                            {client.scanned_at
                              ? dayjs(client.scanned_at.toDate()).format("DD/MM/YYYY")
                              : "-"}
                          </td>
                          <td>
                            {client.expired_at
                              ? dayjs(client.expired_at.toDate()).format("DD/MM/YYYY")
                              : "-"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && !loadingClients && (
              <div style={{textAlign:"center", marginTop:"15px"}}>
                <button
                  className="primary-btn"
                  onClick={() => fetchClients(true)}
                >
                  Charger plus
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/*

  const qrRef = useRef(null);
  const baseUrl = 'https://offrelli.com';
  //const baseUrl = 'https://offrelli.netlify.app';

  const staticQrUrl = storeID ? `${baseUrl}/s/${storeID}` : "";

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `offrini-${discountAmount}.png`;
    a.click();
  };

          <button
            className={activeTab === "qrCode" ? "tab active" : "tab"}
            onClick={() => setActiveTab("qrCode")}
          >
            mon code QR 
          </button>

          {activeTab === "qrCode" && (
          <section className="card">
            {storeID ? (
              <div className="qr-box">
                <div ref={qrRef} className="qr-wrapper">
                  <QRCodeCanvas
                    value={staticQrUrl}
                    size={220}
                  />
                </div>
                <button
                  className="primary-btn"
                  onClick={handleDownloadQR}
                >
                  Télécharger le QR Code
                </button>
              </div>
            ) : (
              <p>Chargement...</p>
            )}
          </section>
        )}
*/
