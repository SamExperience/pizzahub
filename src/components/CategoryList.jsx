export default function CategoryList({ categories }) {
  if (categories.length === 0) {
    return <p>No categories yet.</p>;
  }

  return (
    <ol>
      {categories.map((category) => (
        <li key={category.id}>{category.name}</li>
      ))}
    </ol>
  );
}
